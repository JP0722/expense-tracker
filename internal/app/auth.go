package app

import (
	"database/sql"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("unused-password-for-timing"), bcrypt.DefaultCost)
var defaultCategories = []struct{ Name, Color string }{{"Food & drinks", "#e29a55"}, {"Groceries", "#7e9c62"}, {"Transport", "#6494b5"}, {"Shopping", "#ad83b5"}, {"Bills & utilities", "#c4a24a"}, {"Health", "#d37e88"}, {"Entertainment", "#798bc5"}, {"Travel", "#5eaaa0"}, {"Other", "#929991"}}

type credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func normalizeEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }
func validEmail(email string) bool {
	a, err := mail.ParseAddress(email)
	return err == nil && a.Address == email && len(email) <= 254 && strings.Contains(email, ".")
}
func (s *Server) signup(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if !decode(w, r, &in) {
		return
	}
	in.Email = normalizeEmail(in.Email)
	in.Name = strings.TrimSpace(in.Name)
	if !s.allowAuth(w, r, in.Email) {
		return
	}
	if !validEmail(in.Email) {
		fail(w, 400, "Enter a valid email address")
		return
	}
	if utf8.RuneCountInString(in.Name) < 1 || utf8.RuneCountInString(in.Name) > 80 {
		fail(w, 400, "Name must be between 1 and 80 characters")
		return
	}
	if utf8.RuneCountInString(in.Password) < 10 || len(in.Password) > 72 {
		fail(w, 400, "Password must be at least 10 characters and at most 72 bytes")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		s.dbError(w, err)
		return
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		s.dbError(w, err)
		return
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(r.Context(), "INSERT INTO users(name,email,password_hash) VALUES(?,?,?)", in.Name, in.Email, string(hash))
	if err != nil {
		if uniqueError(err) {
			fail(w, 409, "This email is already registered. Sign in instead.")
		} else {
			s.dbError(w, err)
		}
		return
	}
	id, err := result.LastInsertId()
	if err != nil {
		s.dbError(w, err)
		return
	}
	for _, c := range defaultCategories {
		if _, err = tx.ExecContext(r.Context(), "INSERT INTO categories(user_id,name,color,is_default) VALUES(?,?,?,1)", id, c.Name, c.Color); err != nil {
			s.dbError(w, err)
			return
		}
	}
	if err = tx.Commit(); err != nil {
		s.dbError(w, err)
		return
	}
	if err = s.session(w, r, id); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 201, User{id, in.Name, in.Email, "INR"})
}
func (s *Server) signin(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if !decode(w, r, &in) {
		return
	}
	in.Email = normalizeEmail(in.Email)
	if !s.allowAuth(w, r, in.Email) {
		return
	}
	var u User
	var hash string
	err := s.db.QueryRowContext(r.Context(), "SELECT id,name,email,currency,password_hash FROM users WHERE email=?", in.Email).Scan(&u.ID, &u.Name, &u.Email, &u.Currency, &hash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		s.dbError(w, err)
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		hash = string(dummyHash)
	}
	if check := bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)); check != nil || err != nil {
		fail(w, 401, "Email or password is incorrect")
		return
	}
	if err = s.session(w, r, u.ID); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 200, u)
}
func (s *Server) signout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("penny_session"); err == nil {
		if _, err = s.db.ExecContext(r.Context(), "DELETE FROM sessions WHERE token_hash=?", hashToken(c.Value)); err != nil {
			s.dbError(w, err)
			return
		}
	}
	s.cookie(w, "", -1)
	respond(w, 200, map[string]bool{"ok": true})
}
func uniqueError(err error) bool {
	v := strings.ToLower(err.Error())
	return strings.Contains(v, "unique constraint") || strings.Contains(v, "duplicate entry")
}
