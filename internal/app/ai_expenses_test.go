package app

import (
	"context"
	"encoding/json"
	"errors"
	"expense-tracker/internal/ai"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeExtractor func(context.Context, ai.Input) ([]ai.Draft, error)

func (f fakeExtractor) Extract(ctx context.Context, in ai.Input) ([]ai.Draft, error) {
	return f(ctx, in)
}
func ptr[T any](v T) *T { return &v }

const draftPath = "/api/ai/expense-drafts"

var draftRequest = map[string]string{"text": "Lunch 250 yesterday", "timezone": "Asia/Kolkata"}

func TestDraftEndpoint(t *testing.T) {
	base, db := setup(t)
	alice, user := register(t, base, "Alice")
	bob, _ := register(t, base, "Bob")
	bobCats := getCategories(t, base, bob)
	forbidden := map[int64]bool{}
	for _, c := range bobCats {
		forbidden[c.ID] = true
	}
	calls := 0
	fake := fakeExtractor(func(ctx context.Context, in ai.Input) ([]ai.Draft, error) {
		calls++
		if len(in.Categories) != 9 || in.Text != draftRequest["text"] {
			t.Fatal("missing extraction context")
		}
		zone, _ := time.LoadLocation("Asia/Kolkata")
		if in.Today != time.Now().In(zone).Format("2006-01-02") {
			t.Fatal("incorrect local date")
		}
		if _, ok := ctx.Deadline(); !ok {
			t.Fatal("missing timeout")
		}
		for _, c := range in.Categories {
			if forbidden[c.ID] {
				t.Fatal("another user's category leaked")
			}
		}
		return []ai.Draft{{Title: ptr("Lunch"), Amount: ptr("250.00"), Date: ptr("2026-10-01"), CategoryID: ptr(in.Categories[0].ID)}}, nil
	})
	h := New(db, false, "http://localhost:8080", t.TempDir(), WithAI(fake))
	expectStatus(t, request(t, h, "POST", draftPath, draftRequest, nil), 401)
	for _, input := range []map[string]string{
		{"text": " ", "timezone": "UTC"}, {"text": strings.Repeat("x", 2001), "timezone": "UTC"},
		{"text": "Lunch", "timezone": "Local"}, {"text": "Lunch", "timezone": "Bogus/Zone"},
		{"text": "Lunch", "timezone": "UTC", "userId": "2"},
	} {
		expectStatus(t, request(t, h, "POST", draftPath, input, alice), 400)
	}
	r := httptest.NewRequest("POST", draftPath, strings.NewReader(`{"text":"Lunch","timezone":"UTC"}`))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", "https://other.example")
	r.AddCookie(alice)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	expectStatus(t, w, 403)
	if calls != 0 {
		t.Fatal("invalid requests reached provider")
	}
	w = request(t, h, "POST", draftPath, draftRequest, alice)
	expectStatus(t, w, 200)
	var result struct {
		Drafts []ai.Draft `json:"drafts"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil || len(result.Drafts) != 1 {
		t.Fatal("invalid response")
	}
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM expenses WHERE user_id=?", user.ID).Scan(&count); err != nil || count != 0 {
		t.Fatal("draft generation changed expenses")
	}
	for i := 0; i < 4; i++ {
		expectStatus(t, request(t, h, "POST", draftPath, draftRequest, alice), 200)
	}
	w = request(t, h, "POST", draftPath, draftRequest, alice)
	expectStatus(t, w, 429)
	if calls != 5 || w.Header().Get("Retry-After") == "" {
		t.Fatal("burst limit failed")
	}
}

func TestDraftErrorsAndValidation(t *testing.T) {
	base, db := setup(t)
	cookie, _ := register(t, base, "Alice")
	expectStatus(t, request(t, base, "POST", draftPath, draftRequest, cookie), 503)
	for _, tc := range []struct {
		name   string
		drafts []ai.Draft
		err    error
		status int
	}{
		{"quota", nil, ai.ErrRateLimited, 429}, {"timeout", nil, context.DeadlineExceeded, 504},
		{"unavailable", nil, errors.New("private provider detail"), 503},
		{"malformed", nil, ai.ErrInvalidResponse, 502},
		{"foreign category", []ai.Draft{{CategoryID: ptr(int64(-1))}}, nil, 502},
		{"bad amount", []ai.Draft{{Amount: ptr("2.001")}}, nil, 502},
		{"bad date", []ai.Draft{{Date: ptr("2026-02-30")}}, nil, 502},
		{"long notes", []ai.Draft{{Notes: ptr(strings.Repeat("x", 501))}}, nil, 502},
		{"blank title", []ai.Draft{{Title: ptr(" ")}}, nil, 502},
		{"too many", make([]ai.Draft, 11), nil, 502},
		{"incomplete", []ai.Draft{{Title: ptr("Lunch")}}, nil, 200},
		{"empty", nil, nil, 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := New(db, false, "", t.TempDir(), WithAI(fakeExtractor(func(context.Context, ai.Input) ([]ai.Draft, error) { return tc.drafts, tc.err })))
			w := request(t, h, "POST", draftPath, draftRequest, cookie)
			expectStatus(t, w, tc.status)
			if strings.Contains(w.Body.String(), "private provider detail") {
				t.Fatal("provider error leaked")
			}
			if tc.name == "empty" && !strings.Contains(w.Body.String(), `"drafts":[]`) {
				t.Fatal("expected empty array")
			}
		})
	}
}

func TestDraftQuota(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	q := &draftQuota{}
	for i := 0; i < 20; i++ {
		if !q.allow(1, now) {
			t.Fatal("early user limit")
		}
	}
	if q.allow(1, now) {
		t.Fatal("user limit bypassed")
	}
	var accepted atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func(uid int64) {
			defer wg.Done()
			if q.allow(uid, now) {
				accepted.Add(1)
			}
		}(int64(i + 2))
	}
	wg.Wait()
	if accepted.Load() != 80 {
		t.Fatalf("global quota accepted %d", accepted.Load())
	}
	if !q.allow(1, now.Add(24*time.Hour)) {
		t.Fatal("quota did not reset")
	}
}
