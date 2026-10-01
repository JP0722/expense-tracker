package app

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"expense-tracker/internal/ai"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Server struct {
	db        *sql.DB
	secure    bool
	origin    string
	limiter   *rateLimiter
	extractor ai.Extractor
	aiQuota   *draftQuota
}
type userKey struct{}
type User struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Currency string `json:"currency"`
}
type rateEntry struct {
	count int
	until time.Time
}
type rateLimiter struct {
	sync.Mutex
	entries map[string]rateEntry
}

func (l *rateLimiter) allow(key string, limit int) bool {
	l.Lock()
	defer l.Unlock()
	now := time.Now()
	if len(l.entries) > 5000 {
		for k, v := range l.entries {
			if now.After(v.until) {
				delete(l.entries, k)
			}
		}
		if len(l.entries) > 5000 {
			return false
		}
	}
	e := l.entries[key]
	if now.After(e.until) {
		e = rateEntry{until: now.Add(15 * time.Minute)}
	}
	e.count++
	l.entries[key] = e
	return e.count <= limit
}

// WithAI enables draft generation. Without it, the endpoint returns 503.
func WithAI(extractor ai.Extractor) func(*Server) {
	return func(s *Server) { s.extractor = extractor }
}

func New(db *sql.DB, secure bool, origin, staticDir string, options ...func(*Server)) http.Handler {
	s := &Server{db: db, secure: secure, origin: strings.TrimRight(origin, "/"), limiter: &rateLimiter{entries: make(map[string]rateEntry)}}
	s.aiQuota = &draftQuota{}
	for _, option := range options {
		option(s)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := db.PingContext(r.Context()); err != nil {
			fail(w, 503, "Database unavailable")
			return
		}
		respond(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /api/auth/signup", s.signup)
	mux.HandleFunc("POST /api/auth/signin", s.signin)
	mux.HandleFunc("POST /api/auth/signout", s.signout)
	mux.Handle("GET /api/auth/me", s.auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { respond(w, 200, currentUser(r)) })))
	mux.Handle("GET /api/categories", s.auth(http.HandlerFunc(s.categories)))
	mux.Handle("POST /api/categories", s.auth(http.HandlerFunc(s.createCategory)))
	mux.Handle("PUT /api/categories/{id}", s.auth(http.HandlerFunc(s.updateCategory)))
	mux.Handle("DELETE /api/categories/{id}", s.auth(http.HandlerFunc(s.deleteCategory)))
	mux.Handle("GET /api/expenses", s.auth(http.HandlerFunc(s.expenses)))
	mux.Handle("GET /api/expenses/export", s.auth(http.HandlerFunc(s.export)))
	mux.Handle("POST /api/expenses", s.auth(http.HandlerFunc(s.createExpense)))
	mux.Handle("POST /api/expenses/batch", s.auth(http.HandlerFunc(s.createExpenseBatch)))
	mux.Handle("POST /api/ai/expense-drafts", s.auth(http.HandlerFunc(s.expenseDrafts)))
	mux.Handle("PUT /api/expenses/{id}", s.auth(http.HandlerFunc(s.updateExpense)))
	mux.Handle("DELETE /api/expenses/{id}", s.auth(http.HandlerFunc(s.deleteExpense)))
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { fail(w, 404, "Endpoint not found") })
	mux.Handle("/", staticHandler(staticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		if secure {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000")
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		if r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS" {
			if origin := r.Header.Get("Origin"); origin != "" {
				expected := s.origin
				if expected == "" {
					scheme := "http"
					if r.TLS != nil {
						scheme = "https"
					}
					expected = scheme + "://" + r.Host
				}
				if origin != expected {
					fail(w, 403, "Request origin is not allowed")
					return
				}
			}
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				fail(w, 403, "Cross-site request blocked")
				return
			}
			if r.Method != "DELETE" {
				mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
				if mt != "application/json" {
					fail(w, 415, "Send application/json")
					return
				}
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()
		defer func() {
			if v := recover(); v != nil {
				log.Printf("request panic: %v", v)
				fail(w, 500, "Something went wrong. Please try again.")
			}
		}()
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}
func staticHandler(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" {
			fail(w, 405, "Method not allowed")
			return
		}
		clean := filepath.Clean(filepath.FromSlash("/" + r.URL.Path))
		path := filepath.Join(dir, strings.TrimLeft(clean, "/\\"))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		if filepath.Ext(r.URL.Path) != "" {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}
func ValidateOrigin(origin string) bool {
	u, err := url.Parse(origin)
	return err == nil && u.Scheme == "https" && u.Host != "" && (u.Path == "" || u.Path == "/") && u.RawQuery == "" && u.Fragment == "" && u.User == nil
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}
func fail(w http.ResponseWriter, status int, message string) {
	respond(w, status, map[string]string{"error": message})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		fail(w, 400, "Invalid request body")
		return false
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		fail(w, 400, "Invalid request body")
		return false
	}
	return true
}
func (s *Server) dbError(w http.ResponseWriter, err error) {
	log.Printf("database operation: %v", err)
	fail(w, 500, "Could not save or load your data. Please try again.")
}
func currentUser(r *http.Request) User { return r.Context().Value(userKey{}).(User) }
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func (s *Server) cookie(w http.ResponseWriter, value string, age int) {
	http.SetCookie(w, &http.Cookie{Name: "penny_session", Value: value, Path: "/", MaxAge: age, HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode})
}
func (s *Server) session(w http.ResponseWriter, r *http.Request, userID int64) error {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return err
	}
	token := hex.EncodeToString(b)
	if _, err := s.db.ExecContext(r.Context(), "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)", hashToken(token), userID, time.Now().Add(30*24*time.Hour).Unix()); err != nil {
		return err
	}
	s.cookie(w, token, 30*24*60*60)
	_, err := s.db.ExecContext(r.Context(), "DELETE FROM sessions WHERE expires_at < ?", time.Now().Unix())
	if err != nil {
		log.Printf("session cleanup: %v", err)
	}
	return nil
}
func (s *Server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie("penny_session")
		if err != nil || len(c.Value) != 64 {
			fail(w, 401, "Please sign in to continue")
			return
		}
		var u User
		err = s.db.QueryRowContext(r.Context(), `SELECT u.id,u.name,u.email,u.currency FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`, hashToken(c.Value), time.Now().Unix()).Scan(&u.ID, &u.Name, &u.Email, &u.Currency)
		if errors.Is(err, sql.ErrNoRows) {
			s.cookie(w, "", -1)
			fail(w, 401, "Your session expired. Please sign in again.")
			return
		}
		if err != nil {
			s.dbError(w, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey{}, u)))
	})
}
func (s *Server) allowAuth(w http.ResponseWriter, r *http.Request, email string) bool {
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if !s.limiter.allow("ip:"+ip, 100) || !s.limiter.allow("email:"+email, 15) {
		w.Header().Set("Retry-After", "900")
		fail(w, 429, "Too many attempts. Please try again in 15 minutes.")
		return false
	}
	return true
}
