package app

import (
	"context"
	"errors"
	"expense-tracker/internal/ai"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	_ "time/tzdata" // Support minimal containers without zoneinfo files.
	"unicode/utf8"
)

// Per-process limits reset on restart or a new UTC day. Failed attempts count too.
type draftQuota struct {
	sync.Mutex
	day   string
	total int
	users map[int64]int
}

func (q *draftQuota) allow(userID int64, now time.Time) bool {
	q.Lock()
	defer q.Unlock()
	day := now.UTC().Format("2006-01-02")
	if day != q.day {
		q.day, q.total, q.users = day, 0, make(map[int64]int)
	}
	if q.total >= 100 || q.users[userID] >= 20 {
		return false
	}
	q.total++
	q.users[userID]++
	return true
}

func (s *Server) expenseDrafts(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Text     string `json:"text"`
		Timezone string `json:"timezone"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Text = strings.TrimSpace(in.Text)
	if !utf8.ValidString(in.Text) || len(in.Text) == 0 || utf8.RuneCountInString(in.Text) > 2000 {
		fail(w, 400, "Enter between 1 and 2000 characters")
		return
	}
	if in.Timezone == "" || in.Timezone == "Local" || len(in.Timezone) > 100 {
		fail(w, 400, "Send a valid timezone, such as Asia/Kolkata")
		return
	}
	location, err := time.LoadLocation(in.Timezone)
	if err != nil {
		fail(w, 400, "Send a valid timezone, such as Asia/Kolkata")
		return
	}
	if s.extractor == nil {
		fail(w, 503, "AI entry is not configured. You can still add expenses manually.")
		return
	}
	uid := currentUser(r).ID
	if !s.limiter.allow("ai:"+strconv.FormatInt(uid, 10), 5) {
		w.Header().Set("Retry-After", "900")
		fail(w, 429, "Too many AI requests. Try again in 15 minutes.")
		return
	}
	rows, err := s.db.QueryContext(r.Context(), "SELECT id,name FROM categories WHERE user_id=? ORDER BY id LIMIT 100", uid)
	if err != nil {
		s.dbError(w, err)
		return
	}
	categories := []ai.Category{}
	for rows.Next() {
		var category ai.Category
		if err = rows.Scan(&category.ID, &category.Name); err != nil {
			rows.Close()
			s.dbError(w, err)
			return
		}
		categories = append(categories, category)
	}
	err = rows.Err()
	rows.Close() // Release the SQLite connection before the external request.
	if err != nil {
		s.dbError(w, err)
		return
	}
	now := time.Now()
	if !s.aiQuota.allow(uid, now) {
		reset := now.UTC().Truncate(24 * time.Hour).Add(24 * time.Hour)
		w.Header().Set("Retry-After", strconv.Itoa(int(reset.Sub(now).Seconds())+1))
		fail(w, 429, "Daily AI entry limit reached. You can still add expenses manually.")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	drafts, err := s.extractor.Extract(ctx, ai.Input{Text: in.Text, Today: now.In(location).Format("2006-01-02"), Categories: categories})
	if err != nil {
		switch {
		case errors.Is(err, ai.ErrRateLimited):
			fail(w, 429, "AI provider usage limit reached. Please try later or add expenses manually.")
		case errors.Is(err, ai.ErrInvalidResponse):
			fail(w, 502, "AI could not produce valid expense drafts. Try rephrasing your input.")
		case errors.Is(err, context.DeadlineExceeded):
			fail(w, 504, "AI entry timed out. Please try again.")
		default:
			fail(w, 503, "AI entry is unavailable. You can still add expenses manually.")
		}
		return
	}
	if !validDrafts(drafts, categories) {
		fail(w, 502, "AI could not produce valid expense drafts. Try rephrasing your input.")
		return
	}
	if drafts == nil {
		drafts = []ai.Draft{}
	}
	respond(w, 200, map[string]any{"drafts": drafts})
}

// Missing fields are allowed in drafts; populated fields must satisfy app rules.
func validDrafts(drafts []ai.Draft, categories []ai.Category) bool {
	if len(drafts) > ai.MaxDrafts {
		return false
	}
	allowed := make(map[int64]bool, len(categories))
	for _, c := range categories {
		allowed[c.ID] = true
	}
	for _, d := range drafts {
		if d.Title != nil && (strings.TrimSpace(*d.Title) == "" || utf8.RuneCountInString(*d.Title) > 120) {
			return false
		}
		if d.Notes != nil && utf8.RuneCountInString(*d.Notes) > 500 {
			return false
		}
		if d.Amount != nil {
			if _, err := parseAmount(*d.Amount); err != nil {
				return false
			}
		}
		if d.Date != nil && !validDate(*d.Date) {
			return false
		}
		if d.CategoryID != nil && !allowed[*d.CategoryID] {
			return false
		}
	}
	return true
}
