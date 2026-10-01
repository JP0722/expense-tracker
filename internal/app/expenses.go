package app

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type Expense struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	Amount     int64  `json:"amountCents"`
	Date       string `json:"date"`
	Notes      string `json:"notes"`
	CategoryID int64  `json:"categoryId"`
	Category   string `json:"category"`
	Color      string `json:"color"`
}
type expenseInput struct {
	Title      string `json:"title"`
	Amount     string `json:"amount"`
	Date       string `json:"date"`
	Notes      string `json:"notes"`
	CategoryID int64  `json:"categoryId"`
}
type Breakdown struct {
	Name   string `json:"name"`
	Color  string `json:"color"`
	Amount int64  `json:"amountCents"`
	Count  int    `json:"count"`
}
type Period struct {
	Date   string `json:"date"`
	Amount int64  `json:"amountCents"`
	Count  int    `json:"count"`
}
type Report struct {
	Expenses   []Expense   `json:"expenses"`
	Total      int64       `json:"totalCents"`
	Count      int         `json:"count"`
	ActiveDays int         `json:"activeDays"`
	Largest    int64       `json:"largestCents"`
	Categories []Breakdown `json:"categories"`
	Periods    []Period    `json:"periods"`
	Page       int         `json:"page"`
	PageSize   int         `json:"pageSize"`
}

var amountPattern = regexp.MustCompile(`^(0|[1-9][0-9]{0,8})(\.[0-9]{1,2})?$`)

func parseAmount(v string) (int64, error) {
	if !amountPattern.MatchString(v) {
		return 0, fmt.Errorf("Enter an amount with up to two decimal places (maximum 999,999,999.99)")
	}
	parts := strings.Split(v, ".")
	whole, _ := strconv.ParseInt(parts[0], 10, 64)
	fraction := int64(0)
	if len(parts) > 1 {
		p := parts[1]
		if len(p) == 1 {
			p += "0"
		}
		fraction, _ = strconv.ParseInt(p, 10, 64)
	}
	amount := whole*100 + fraction
	if amount <= 0 {
		return 0, fmt.Errorf("Amount must be greater than zero")
	}
	return amount, nil
}
func validDate(v string) bool {
	d, err := time.Parse("2006-01-02", v)
	return err == nil && len(v) == 10 && d.Year() >= 1900 && d.Year() <= 9999 && d.Format("2006-01-02") == v
}
func (s *Server) expenseBody(w http.ResponseWriter, r *http.Request) (expenseInput, int64, bool) {
	var in expenseInput
	if !decode(w, r, &in) {
		return in, 0, false
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Notes = strings.TrimSpace(in.Notes)
	if utf8.RuneCountInString(in.Title) < 1 || utf8.RuneCountInString(in.Title) > 120 {
		fail(w, 400, "Description must be between 1 and 120 characters")
		return in, 0, false
	}
	if utf8.RuneCountInString(in.Notes) > 500 {
		fail(w, 400, "Notes cannot exceed 500 characters")
		return in, 0, false
	}
	amount, err := parseAmount(in.Amount)
	if err != nil {
		fail(w, 400, err.Error())
		return in, 0, false
	}
	if !validDate(in.Date) {
		fail(w, 400, "Choose a valid expense date")
		return in, 0, false
	}
	var n int
	if err = s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM categories WHERE id=? AND user_id=?", in.CategoryID, currentUser(r).ID).Scan(&n); err != nil {
		s.dbError(w, err)
		return in, 0, false
	}
	if n == 0 {
		fail(w, 400, "Choose one of your categories")
		return in, 0, false
	}
	return in, amount, true
}
func (s *Server) createExpense(w http.ResponseWriter, r *http.Request) {
	in, amount, ok := s.expenseBody(w, r)
	if !ok {
		return
	}
	result, err := s.db.ExecContext(r.Context(), "INSERT INTO expenses(user_id,category_id,title,amount_cents,expense_date,notes,created_at) VALUES(?,?,?,?,?,?,?)", currentUser(r).ID, in.CategoryID, in.Title, amount, in.Date, in.Notes, time.Now().Unix())
	if err != nil {
		s.dbError(w, err)
		return
	}
	id, err := result.LastInsertId()
	if err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 201, map[string]int64{"id": id})
}
func (s *Server) updateExpense(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	in, amount, ok := s.expenseBody(w, r)
	if !ok {
		return
	}
	var n int
	if err := s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM expenses WHERE id=? AND user_id=?", id, currentUser(r).ID).Scan(&n); err != nil {
		s.dbError(w, err)
		return
	}
	if n == 0 {
		fail(w, 404, "Expense not found")
		return
	}
	_, err := s.db.ExecContext(r.Context(), "UPDATE expenses SET category_id=?,title=?,amount_cents=?,expense_date=?,notes=? WHERE id=? AND user_id=?", in.CategoryID, in.Title, amount, in.Date, in.Notes, id, currentUser(r).ID)
	if err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
func (s *Server) deleteExpense(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	result, err := s.db.ExecContext(r.Context(), "DELETE FROM expenses WHERE id=? AND user_id=?", id, currentUser(r).ID)
	if err != nil {
		s.dbError(w, err)
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		fail(w, 404, "Expense not found")
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
func filters(r *http.Request) (string, []any, error) {
	q := r.URL.Query()
	where := " WHERE e.user_id=?"
	args := []any{currentUser(r).ID}
	from, to := q.Get("from"), q.Get("to")
	if (from != "" && !validDate(from)) || (to != "" && !validDate(to)) {
		return "", nil, fmt.Errorf("Choose valid start and end dates")
	}
	if from != "" && to != "" && from > to {
		return "", nil, fmt.Errorf("Start date must be on or before end date")
	}
	if from != "" {
		where += " AND e.expense_date>=?"
		args = append(args, from)
	}
	if to != "" {
		where += " AND e.expense_date<=?"
		args = append(args, to)
	}
	if cat := q.Get("category"); cat != "" {
		id, err := strconv.ParseInt(cat, 10, 64)
		if err != nil || id <= 0 {
			return "", nil, fmt.Errorf("Invalid category")
		}
		where += " AND e.category_id=?"
		args = append(args, id)
	}
	if search := strings.TrimSpace(q.Get("q")); search != "" {
		if utf8.RuneCountInString(search) > 120 {
			return "", nil, fmt.Errorf("Search is too long")
		}
		search = strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(search)
		where += " AND (LOWER(e.title) LIKE LOWER(?) ESCAPE '!' OR LOWER(e.notes) LIKE LOWER(?) ESCAPE '!')"
		args = append(args, "%"+search+"%", "%"+search+"%")
	}
	return where, args, nil
}

const expenseSelect = "SELECT e.id,e.title,e.amount_cents,e.expense_date,e.notes,c.id,c.name,c.color FROM expenses e JOIN categories c ON c.id=e.category_id"

func (s *Server) expenses(w http.ResponseWriter, r *http.Request) {
	where, args, err := filters(r)
	if err != nil {
		fail(w, 400, err.Error())
		return
	}
	group := r.URL.Query().Get("group")
	length := 10
	switch group {
	case "", "day":
	case "month":
		length = 7
	case "year":
		length = 4
	default:
		fail(w, 400, "Invalid grouping")
		return
	}
	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		page, err = strconv.Atoi(p)
		if err != nil || page < 1 || page > 1000000 {
			fail(w, 400, "Invalid page")
			return
		}
	}
	out := Report{Expenses: []Expense{}, Categories: []Breakdown{}, Periods: []Period{}, Page: page, PageSize: 25}
	// Keep totals and rows in a consistent snapshot if another device writes mid-request.
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		s.dbError(w, err)
		return
	}
	defer tx.Rollback()
	err = tx.QueryRowContext(r.Context(), "SELECT COALESCE(SUM(e.amount_cents),0),COUNT(*),COUNT(DISTINCT e.expense_date),COALESCE(MAX(e.amount_cents),0) FROM expenses e"+where, args...).Scan(&out.Total, &out.Count, &out.ActiveDays, &out.Largest)
	if err != nil {
		s.dbError(w, err)
		return
	}
	// Each result set is closed before the next query, including for single-connection SQLite.
	rows, err := tx.QueryContext(r.Context(), "SELECT c.name,c.color,SUM(e.amount_cents),COUNT(*) FROM expenses e JOIN categories c ON c.id=e.category_id"+where+" GROUP BY c.id,c.name,c.color ORDER BY SUM(e.amount_cents) DESC,c.name", args...)
	if err != nil {
		s.dbError(w, err)
		return
	}
	for rows.Next() {
		var b Breakdown
		if err = rows.Scan(&b.Name, &b.Color, &b.Amount, &b.Count); err != nil {
			rows.Close()
			s.dbError(w, err)
			return
		}
		out.Categories = append(out.Categories, b)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		s.dbError(w, err)
		return
	}
	periodSQL := fmt.Sprintf("SELECT SUBSTR(e.expense_date,1,%d),SUM(e.amount_cents),COUNT(*) FROM expenses e%s GROUP BY SUBSTR(e.expense_date,1,%d) ORDER BY 1 DESC", length, where, length)
	rows, err = tx.QueryContext(r.Context(), periodSQL, args...)
	if err != nil {
		s.dbError(w, err)
		return
	}
	for rows.Next() {
		var p Period
		if err = rows.Scan(&p.Date, &p.Amount, &p.Count); err != nil {
			rows.Close()
			s.dbError(w, err)
			return
		}
		out.Periods = append(out.Periods, p)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		s.dbError(w, err)
		return
	}
	listArgs := append(append([]any{}, args...), out.PageSize, (page-1)*out.PageSize)
	rows, err = tx.QueryContext(r.Context(), expenseSelect+where+" ORDER BY e.expense_date DESC,e.id DESC LIMIT ? OFFSET ?", listArgs...)
	if err != nil {
		s.dbError(w, err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var e Expense
		if err = rows.Scan(&e.ID, &e.Title, &e.Amount, &e.Date, &e.Notes, &e.CategoryID, &e.Category, &e.Color); err != nil {
			s.dbError(w, err)
			return
		}
		out.Expenses = append(out.Expenses, e)
	}
	if err = rows.Err(); err != nil {
		s.dbError(w, err)
		return
	}
	rows.Close()
	if err = tx.Commit(); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 200, out)
}
func csvSafe(s string) string {
	trimmed := strings.TrimLeft(s, " \t\r\n")
	if trimmed != "" && strings.ContainsAny(trimmed[:1], "=+-@") {
		return "'" + s
	}
	return s
}
func (s *Server) export(w http.ResponseWriter, r *http.Request) {
	where, args, err := filters(r)
	if err != nil {
		fail(w, 400, err.Error())
		return
	}
	rows, err := s.db.QueryContext(r.Context(), expenseSelect+where+" ORDER BY e.expense_date DESC,e.id DESC", args...)
	if err != nil {
		s.dbError(w, err)
		return
	}
	defer rows.Close()
	// Buffer before sending headers so a database error never yields a partial successful download.
	var buf strings.Builder
	writer := csv.NewWriter(&buf)
	_ = writer.Write([]string{"Expense date", "Description", "Category", "Amount", "Currency", "Notes"})
	for rows.Next() {
		var e Expense
		if err = rows.Scan(&e.ID, &e.Title, &e.Amount, &e.Date, &e.Notes, &e.CategoryID, &e.Category, &e.Color); err != nil {
			s.dbError(w, err)
			return
		}
		_ = writer.Write([]string{e.Date, csvSafe(e.Title), csvSafe(e.Category), fmt.Sprintf("%d.%02d", e.Amount/100, e.Amount%100), currentUser(r).Currency, csvSafe(e.Notes)})
	}
	if err = rows.Err(); err != nil {
		s.dbError(w, err)
		return
	}
	writer.Flush()
	if err = writer.Error(); err != nil {
		s.dbError(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="penny-expenses.csv"`)
	_, _ = w.Write([]byte("\ufeff" + buf.String()))
}
