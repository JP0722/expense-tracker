package app

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

type Category struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Color   string `json:"color"`
	Default bool   `json:"isDefault"`
	Count   int    `json:"count"`
}
type categoryInput struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

var colorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func (s *Server) categories(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT c.id,c.name,c.color,c.is_default,COUNT(e.id) FROM categories c LEFT JOIN expenses e ON e.category_id=c.id AND e.user_id=c.user_id WHERE c.user_id=? GROUP BY c.id,c.name,c.color,c.is_default ORDER BY c.is_default DESC,c.name`, currentUser(r).ID)
	if err != nil {
		s.dbError(w, err)
		return
	}
	defer rows.Close()
	out := []Category{}
	for rows.Next() {
		var c Category
		var def int
		if err = rows.Scan(&c.ID, &c.Name, &c.Color, &def, &c.Count); err != nil {
			s.dbError(w, err)
			return
		}
		c.Default = def == 1
		out = append(out, c)
	}
	if err = rows.Err(); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 200, out)
}
func categoryBody(w http.ResponseWriter, r *http.Request) (categoryInput, bool) {
	var in categoryInput
	if !decode(w, r, &in) {
		return in, false
	}
	in.Name = strings.TrimSpace(in.Name)
	if utf8.RuneCountInString(in.Name) < 1 || utf8.RuneCountInString(in.Name) > 40 {
		fail(w, 400, "Category name must be between 1 and 40 characters")
		return in, false
	}
	if !colorPattern.MatchString(in.Color) {
		fail(w, 400, "Choose a valid category color")
		return in, false
	}
	return in, true
}
func (s *Server) categoryDuplicate(r *http.Request, name string, exclude int64) (bool, error) {
	var n int
	err := s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM categories WHERE user_id=? AND LOWER(name)=LOWER(?) AND id<>?", currentUser(r).ID, name, exclude).Scan(&n)
	return n > 0, err
}
func (s *Server) createCategory(w http.ResponseWriter, r *http.Request) {
	in, ok := categoryBody(w, r)
	if !ok {
		return
	}
	uid := currentUser(r).ID
	dup, err := s.categoryDuplicate(r, in.Name, 0)
	if err != nil {
		s.dbError(w, err)
		return
	}
	if dup {
		fail(w, 409, "You already have a category with that name")
		return
	}
	var count int
	if err = s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM categories WHERE user_id=?", uid).Scan(&count); err != nil {
		s.dbError(w, err)
		return
	}
	if count >= 100 {
		fail(w, 400, "You can have up to 100 categories")
		return
	}
	result, err := s.db.ExecContext(r.Context(), "INSERT INTO categories(user_id,name,color) VALUES(?,?,?)", uid, in.Name, in.Color)
	if err != nil {
		if uniqueError(err) {
			fail(w, 409, "You already have a category with that name")
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
	respond(w, 201, Category{ID: id, Name: in.Name, Color: in.Color})
}
func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		fail(w, 400, "Invalid ID")
		return 0, false
	}
	return id, true
}
func (s *Server) updateCategory(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	in, ok := categoryBody(w, r)
	if !ok {
		return
	}
	dup, err := s.categoryDuplicate(r, in.Name, id)
	if err != nil {
		s.dbError(w, err)
		return
	}
	if dup {
		fail(w, 409, "You already have a category with that name")
		return
	}
	var count int
	if err = s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM categories WHERE id=? AND user_id=?", id, currentUser(r).ID).Scan(&count); err != nil {
		s.dbError(w, err)
		return
	}
	if count == 0 {
		fail(w, 404, "Category not found")
		return
	}
	_, err = s.db.ExecContext(r.Context(), "UPDATE categories SET name=?,color=? WHERE id=? AND user_id=?", in.Name, in.Color, id, currentUser(r).ID)
	if err != nil {
		if uniqueError(err) {
			fail(w, 409, "You already have a category with that name")
		} else {
			s.dbError(w, err)
		}
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
func (s *Server) deleteCategory(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var count int
	if err := s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM expenses WHERE category_id=? AND user_id=?", id, currentUser(r).ID).Scan(&count); err != nil {
		s.dbError(w, err)
		return
	}
	if count > 0 {
		fail(w, 409, "Move this category's expenses to another category before deleting it")
		return
	}
	result, err := s.db.ExecContext(r.Context(), "DELETE FROM categories WHERE id=? AND user_id=?", id, currentUser(r).ID)
	if err != nil {
		fail(w, 409, "This category is in use and cannot be deleted")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		fail(w, 404, "Category not found")
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
