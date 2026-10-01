package app

import (
	"fmt"
	"testing"
)

func TestExpenseBatchAtomicRetryAndIsolation(t *testing.T) {
	h, db := setup(t)
	alice, _ := register(t, h, "Alice")
	bob, _ := register(t, h, "Bob")
	a := getCategories(t, h, alice)[0].ID
	b := getCategories(t, h, bob)[0].ID
	expenses := []expenseInput{{Title: "Lunch", Amount: "250", Date: "2026-10-01", CategoryID: a}, {Title: "Cab", Amount: "180", Date: "2026-10-01", CategoryID: b}}
	body := map[string]any{"requestId": "batch-request-0001", "expenses": expenses}
	expectStatus(t, request(t, h, "POST", "/api/expenses/batch", body, nil), 401)
	expectStatus(t, request(t, h, "POST", "/api/expenses/batch", body, alice), 400)
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM expense_batches WHERE request_id=?", "batch-request-0001").Scan(&count); err != nil || count != 0 {
		t.Fatal("failed batch receipt was not rolled back")
	}
	if report(t, h, alice, "").Count != 0 {
		t.Fatal("partial batch saved")
	}
	expenses[1].CategoryID = a
	first := request(t, h, "POST", "/api/expenses/batch", body, alice)
	expectStatus(t, first, 201)
	// A fresh handler simulates a process restart: receipts are in the database.
	h = New(db, false, "", t.TempDir())
	retry := request(t, h, "POST", "/api/expenses/batch", body, alice)
	expectStatus(t, retry, 200)
	if first.Body.String() != retry.Body.String() || report(t, h, alice, "").Count != 2 {
		t.Fatal("retry duplicated expenses")
	}
	expenses[0].Amount = "300"
	expectStatus(t, request(t, h, "POST", "/api/expenses/batch", body, alice), 409)
	expenses[0].CategoryID = b
	expenses[1].CategoryID = b
	expectStatus(t, request(t, h, "POST", "/api/expenses/batch", body, bob), 201)
	if report(t, h, bob, "").Count != 2 {
		t.Fatal("request IDs should be account scoped")
	}
}

func TestExpenseBatchValidation(t *testing.T) {
	h, _ := setup(t)
	cookie, _ := register(t, h, "Alice")
	cat := getCategories(t, h, cookie)[0].ID
	for i, expenses := range [][]expenseInput{nil, make([]expenseInput, 11), {{Title: "x", Amount: "1.001", Date: "2026-10-01", CategoryID: cat}}, {{Title: "x", Amount: "1", Date: "2026-02-30", CategoryID: cat}}} {
		expectStatus(t, request(t, h, "POST", "/api/expenses/batch", map[string]any{"requestId": fmt.Sprintf("request-key-%08d", i), "expenses": expenses}, cookie), 400)
	}
}
