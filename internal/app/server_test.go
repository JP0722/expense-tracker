package app

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Set TEST_MYSQL=1 plus DB_* to run this same contract suite against a disposable MySQL database.
// Tests must never point at a real user's database.
func setup(t *testing.T) (http.Handler, *sql.DB) {
	t.Helper()
	if os.Getenv("TEST_MYSQL") != "1" {
		t.Setenv("DB_HOST", "")
		t.Setenv("APP_ENV", "")
		t.Setenv("SQLITE_PATH", filepath.Join(t.TempDir(), "test.db"))
	}
	db, err := OpenDB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return New(db, false, "http://localhost:8080", t.TempDir()), db
}
func request(t *testing.T, h http.Handler, method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var b bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&b).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	r := httptest.NewRequest(method, path, &b)
	r.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
func expectStatus(t *testing.T, w *httptest.ResponseRecorder, status int) {
	t.Helper()
	if w.Code != status {
		t.Fatalf("want status %d, got %d: %s", status, w.Code, w.Body.String())
	}
}
func register(t *testing.T, h http.Handler, label string) (*http.Cookie, User) {
	t.Helper()
	email := fmt.Sprintf("%s-%d@example.com", label, time.Now().UnixNano())
	w := request(t, h, "POST", "/api/auth/signup", map[string]string{"name": label, "email": email, "password": "a-good-password-123"}, nil)
	expectStatus(t, w, 201)
	var u User
	json.Unmarshal(w.Body.Bytes(), &u)
	cookies := w.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("missing session cookie")
	}
	return cookies[0], u
}
func getCategories(t *testing.T, h http.Handler, c *http.Cookie) []Category {
	t.Helper()
	w := request(t, h, "GET", "/api/categories", nil, c)
	expectStatus(t, w, 200)
	var cats []Category
	if err := json.Unmarshal(w.Body.Bytes(), &cats); err != nil {
		t.Fatal(err)
	}
	return cats
}
func add(t *testing.T, h http.Handler, c *http.Cookie, cat int64, title, amount, date string) int64 {
	t.Helper()
	w := request(t, h, "POST", "/api/expenses", expenseInput{Title: title, Amount: amount, Date: date, CategoryID: cat}, c)
	expectStatus(t, w, 201)
	var out map[string]int64
	json.Unmarshal(w.Body.Bytes(), &out)
	return out["id"]
}
func report(t *testing.T, h http.Handler, c *http.Cookie, query string) Report {
	t.Helper()
	w := request(t, h, "GET", "/api/expenses"+query, nil, c)
	expectStatus(t, w, 200)
	var out Report
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestAuthSessions(t *testing.T) {
	h, db := setup(t)
	cookie, u := register(t, h, "Alice")
	if !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatal("session cookie flags missing")
	}
	expectStatus(t, request(t, h, "GET", "/api/auth/me", nil, cookie), 200)
	expectStatus(t, request(t, h, "GET", "/api/expenses", nil, nil), 401)
	expectStatus(t, request(t, h, "POST", "/api/auth/signin", credentials{Email: u.Email, Password: "wrong-password"}, nil), 401)
	login := request(t, h, "POST", "/api/auth/signin", credentials{Email: strings.ToUpper(u.Email), Password: "a-good-password-123"}, nil)
	expectStatus(t, login, 200)
	var hash string
	if err := db.QueryRow("SELECT password_hash FROM users WHERE id=?", u.ID).Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "$2") || hash == "a-good-password-123" {
		t.Fatal("password not hashed")
	}
	var stored string
	if err := db.QueryRow("SELECT token_hash FROM sessions WHERE token_hash=?", hashToken(cookie.Value)).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored == cookie.Value {
		t.Fatal("raw session persisted")
	}
	expectStatus(t, request(t, h, "POST", "/api/auth/signout", map[string]string{}, cookie), 200)
	expectStatus(t, request(t, h, "GET", "/api/auth/me", nil, cookie), 401)
	newCookie := login.Result().Cookies()[0]
	if _, err := db.Exec("UPDATE sessions SET expires_at=? WHERE token_hash=?", time.Now().Add(-time.Hour).Unix(), hashToken(newCookie.Value)); err != nil {
		t.Fatal(err)
	}
	expectStatus(t, request(t, h, "GET", "/api/auth/me", nil, newCookie), 401)
	expectStatus(t, request(t, h, "POST", "/api/auth/signup", credentials{Name: "A", Email: u.Email, Password: "a-good-password-123"}, nil), 409)
	expectStatus(t, request(t, h, "POST", "/api/auth/signup", credentials{Name: "A", Email: "invalid", Password: "short"}, nil), 400)
}
func TestExpenseDatesReportsAndIsolation(t *testing.T) {
	h, _ := setup(t)
	alice, _ := register(t, h, "Alice")
	bob, _ := register(t, h, "Bob")
	cats := getCategories(t, h, alice)
	bobCats := getCategories(t, h, bob)
	if len(cats) != 9 {
		t.Fatalf("want 9 defaults, got %d", len(cats))
	}
	oldest := add(t, h, alice, cats[0].ID, "Last year", "10.10", "2023-12-31")
	add(t, h, alice, cats[0].ID, "New year", "20.20", "2024-01-01")
	add(t, h, alice, cats[1].ID, "Leap day", "30.30", "2024-02-29")
	add(t, h, alice, cats[0].ID, "March", "40.40", "2024-03-01")
	add(t, h, bob, bobCats[0].ID, "Private", "999", "2024-02-29")
	all := report(t, h, alice, "")
	if all.Count != 4 || all.Total != 10100 || all.Expenses[0].Date != "2024-03-01" {
		t.Fatalf("incorrect all-time report: %+v", all)
	}
	day := report(t, h, alice, "?from=2024-02-29&to=2024-02-29")
	if day.Count != 1 || day.Total != 3030 || day.ActiveDays != 1 {
		t.Fatalf("day: %+v", day)
	}
	month := report(t, h, alice, "?from=2024-02-01&to=2024-02-29")
	if month.Count != 1 {
		t.Fatalf("month: %+v", month)
	}
	year := report(t, h, alice, "?from=2024-01-01&to=2024-12-31&group=month")
	if year.Count != 3 || len(year.Periods) != 3 || year.Total != 9090 {
		t.Fatalf("year: %+v", year)
	}
	custom := report(t, h, alice, "?from=2023-12-31&to=2024-01-01&group=year")
	if custom.Count != 2 || custom.Total != 3030 || len(custom.Periods) != 2 {
		t.Fatalf("custom boundaries: %+v", custom)
	}
	filtered := report(t, h, alice, fmt.Sprintf("?category=%d&q=year", cats[0].ID))
	if filtered.Count != 2 || filtered.Total != 3030 {
		t.Fatalf("filtered: %+v", filtered)
	}
	expectStatus(t, request(t, h, "DELETE", fmt.Sprintf("/api/expenses/%d", oldest), nil, bob), 404)
	expectStatus(t, request(t, h, "PUT", fmt.Sprintf("/api/expenses/%d", oldest), expenseInput{Title: "Hijack", Amount: "1", Date: "2024-01-01", CategoryID: bobCats[0].ID}, bob), 404)
	expectStatus(t, request(t, h, "POST", "/api/expenses", expenseInput{Title: "Other category", Amount: "1", Date: "2024-01-01", CategoryID: bobCats[0].ID}, alice), 400)
	expectStatus(t, request(t, h, "GET", "/api/expenses?from=2024-03-01&to=2024-01-01", nil, alice), 400)
	expectStatus(t, request(t, h, "GET", "/api/expenses?from=2023-02-29", nil, alice), 400)
	expectStatus(t, request(t, h, "PUT", fmt.Sprintf("/api/expenses/%d", oldest), expenseInput{Title: "Moved", Amount: "15.25", Date: "2024-02-29", CategoryID: cats[1].ID, Notes: "Updated"}, alice), 200)
	updated := report(t, h, alice, "?from=2024-02-29&to=2024-02-29")
	if updated.Count != 2 || updated.Total != 4555 {
		t.Fatalf("updated: %+v", updated)
	}
	expectStatus(t, request(t, h, "DELETE", fmt.Sprintf("/api/expenses/%d", oldest), nil, alice), 200)
	if report(t, h, alice, "").Count != 3 {
		t.Fatal("delete did not persist")
	}
}
func TestCategoryLifecycle(t *testing.T) {
	h, _ := setup(t)
	cookie, _ := register(t, h, "Categories")
	other, _ := register(t, h, "Other")
	before := getCategories(t, h, cookie)
	w := request(t, h, "POST", "/api/categories", categoryInput{Name: "Projects", Color: "#123456"}, cookie)
	expectStatus(t, w, 201)
	var c Category
	json.Unmarshal(w.Body.Bytes(), &c)
	if len(getCategories(t, h, cookie)) != len(before)+1 {
		t.Fatal("category not created")
	}
	expectStatus(t, request(t, h, "POST", "/api/categories", categoryInput{Name: "projects", Color: "#123456"}, cookie), 409)
	expectStatus(t, request(t, h, "PUT", fmt.Sprintf("/api/categories/%d", c.ID), categoryInput{Name: "Hobbies", Color: "#654321"}, cookie), 200)
	expectStatus(t, request(t, h, "PUT", fmt.Sprintf("/api/categories/%d", c.ID), categoryInput{Name: "Stolen", Color: "#654321"}, other), 404)
	id := add(t, h, cookie, c.ID, "Project supplies", "99.99", "2024-04-12")
	expectStatus(t, request(t, h, "DELETE", fmt.Sprintf("/api/categories/%d", c.ID), nil, cookie), 409)
	expectStatus(t, request(t, h, "DELETE", fmt.Sprintf("/api/expenses/%d", id), nil, cookie), 200)
	expectStatus(t, request(t, h, "DELETE", fmt.Sprintf("/api/categories/%d", c.ID), nil, cookie), 200)
}
func TestPaginationAndCSV(t *testing.T) {
	h, _ := setup(t)
	cookie, _ := register(t, h, "Pagination")
	cat := getCategories(t, h, cookie)[0]
	for i := 0; i < 28; i++ {
		add(t, h, cookie, cat.ID, fmt.Sprintf("Item %02d", i), "0.10", "2024-01-01")
	}
	add(t, h, cookie, cat.ID, "=SUM(1,2)", "0.20", "2024-01-01")
	first := report(t, h, cookie, "")
	second := report(t, h, cookie, "?page=2")
	if len(first.Expenses) != 25 || len(second.Expenses) != 4 || first.Total != 300 || second.Total != 300 {
		t.Fatalf("pagination or exact cents failed: %d %d %d", len(first.Expenses), len(second.Expenses), first.Total)
	}
	csv := request(t, h, "GET", "/api/expenses/export?from=2024-01-01&to=2024-01-01", nil, cookie)
	expectStatus(t, csv, 200)
	if lines := strings.Count(csv.Body.String(), "\n"); lines != 30 {
		t.Fatalf("export omitted rows: %d lines", lines)
	}
	if !strings.Contains(csv.Body.String(), "'=SUM(1,2)") {
		t.Fatal("CSV formula not neutralized")
	}
	add(t, h, cookie, cat.ID, "100% literal", "1", "2024-01-01")
	if report(t, h, cookie, "?q=%25").Count != 1 {
		t.Fatal("search wildcard not escaped")
	}
}
func TestValidationAndCSRF(t *testing.T) {
	for _, v := range []string{"0", "-1", "1.001", "1e3", "NaN", "1000000000", "01", ""} {
		if _, err := parseAmount(v); err == nil {
			t.Errorf("accepted invalid amount %q", v)
		}
	}
	for v, want := range map[string]int64{"0.01": 1, "12.1": 1210, "999999999.99": 99999999999} {
		if got, err := parseAmount(v); err != nil || got != want {
			t.Errorf("amount %s => %d %v", v, got, err)
		}
	}
	h, _ := setup(t)
	r := httptest.NewRequest("POST", "/api/auth/signup", strings.NewReader(`{}`))
	r.Header.Set("Origin", "https://evil.example")
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	expectStatus(t, w, 403)
	r = httptest.NewRequest("POST", "/api/auth/signup", strings.NewReader(`{}`))
	r.Header.Set("Content-Type", "text/plain")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	expectStatus(t, w, 415)
	for i := 0; i < 16; i++ {
		w = request(t, h, "POST", "/api/auth/signin", credentials{Email: "rate-limit@example.com", Password: "bad"}, nil)
	}
	expectStatus(t, w, 429)
}

func TestProductionGuards(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_HOST", "")
	if db, err := OpenDB(); err == nil {
		db.Close()
		t.Fatal("production accepted local SQLite")
	}
	t.Setenv("DB_HOST", "localhost")
	t.Setenv("DB_TLS", "false")
	if db, err := OpenDB(); err == nil {
		db.Close()
		t.Fatal("production accepted unencrypted MySQL")
	}
	for _, origin := range []string{"http://example.com", "https://example.com/path", "https://example.com?x=1", "", "https://user:pass@example.com"} {
		if ValidateOrigin(origin) {
			t.Errorf("accepted origin %q", origin)
		}
	}
	if !ValidateOrigin("https://penny.example.com") {
		t.Fatal("valid production origin rejected")
	}
	w := httptest.NewRecorder()
	s := &Server{secure: true}
	s.cookie(w, "test-token", 3600)
	c := w.Result().Cookies()[0]
	if !c.Secure || !c.HttpOnly || c.SameSite != http.SameSiteLaxMode {
		t.Fatal("production cookie protections missing")
	}
}
