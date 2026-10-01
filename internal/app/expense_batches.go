package app

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

var batchKeyPattern = regexp.MustCompile(`^[a-zA-Z0-9-]{16,64}$`)

func (s *Server) createExpenseBatch(w http.ResponseWriter, r *http.Request) {
	var in struct {
		RequestID string         `json:"requestId"`
		Expenses  []expenseInput `json:"expenses"`
	}
	// Ten maximum-sized drafts need more room than the single-expense decoder.
	r.Body = http.MaxBytesReader(w, r.Body, 65536)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(&in); err != nil {
		fail(w, 400, "Invalid request body")
		return
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		fail(w, 400, "Invalid request body")
		return
	}
	if !batchKeyPattern.MatchString(in.RequestID) || len(in.Expenses) < 1 || len(in.Expenses) > 10 {
		fail(w, 400, "Send a request ID and between 1 and 10 expenses")
		return
	}
	amounts := make([]int64, len(in.Expenses))
	for i := range in.Expenses {
		e := &in.Expenses[i]
		e.Title, e.Notes = strings.TrimSpace(e.Title), strings.TrimSpace(e.Notes)
		amount, err := parseAmount(e.Amount)
		if err != nil || utf8.RuneCountInString(e.Title) < 1 || utf8.RuneCountInString(e.Title) > 120 || utf8.RuneCountInString(e.Notes) > 500 || !validDate(e.Date) {
			fail(w, 400, "Check every expense's description, amount, date, and notes")
			return
		}
		amounts[i] = amount
	}
	payload, _ := json.Marshal(in.Expenses)
	hash := hashToken(string(payload))
	uid := currentUser(r).ID
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		s.dbError(w, err)
		return
	}
	defer tx.Rollback()
	// Reserve the key first. Concurrent retries serialize on this unique key.
	_, err = tx.ExecContext(r.Context(), "INSERT INTO expense_batches(user_id,request_id,payload_hash,expense_ids) VALUES(?,?,?,?)", uid, in.RequestID, hash, "[]")
	if err != nil {
		tx.Rollback()
		if !uniqueError(err) {
			s.dbError(w, err)
			return
		}
		var previousHash, stored string
		if err = s.db.QueryRowContext(r.Context(), "SELECT payload_hash,expense_ids FROM expense_batches WHERE user_id=? AND request_id=?", uid, in.RequestID).Scan(&previousHash, &stored); err != nil {
			s.dbError(w, err)
			return
		}
		if previousHash != hash {
			fail(w, 409, "This request ID was already used for different expenses")
			return
		}
		var ids []int64
		if err = json.Unmarshal([]byte(stored), &ids); err != nil {
			s.dbError(w, err)
			return
		}
		respond(w, 200, map[string]any{"ids": ids})
		return
	}
	ids := make([]int64, 0, len(in.Expenses))
	for i, e := range in.Expenses {
		var count int
		if err = tx.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM categories WHERE id=? AND user_id=?", e.CategoryID, uid).Scan(&count); err != nil {
			s.dbError(w, err)
			return
		}
		if count != 1 {
			fail(w, 400, "Choose one of your categories for every expense")
			return
		}
		result, err := tx.ExecContext(r.Context(), "INSERT INTO expenses(user_id,category_id,title,amount_cents,expense_date,notes,created_at) VALUES(?,?,?,?,?,?,?)", uid, e.CategoryID, e.Title, amounts[i], e.Date, e.Notes, time.Now().Unix())
		if err != nil {
			s.dbError(w, err)
			return
		}
		id, err := result.LastInsertId()
		if err != nil {
			s.dbError(w, err)
			return
		}
		ids = append(ids, id)
	}
	stored, _ := json.Marshal(ids)
	if _, err = tx.ExecContext(r.Context(), "UPDATE expense_batches SET expense_ids=? WHERE user_id=? AND request_id=?", string(stored), uid, in.RequestID); err != nil {
		s.dbError(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 201, map[string]any{"ids": ids})
}
