import { useState } from "react";
import { api } from "../../api/client.js";
import { Modal } from "../ui/Modal.jsx";
import { ErrorText } from "../ui/ErrorText.jsx";
import { localDate } from "../../utils/dates.js";
import { Spinner } from "../ui/Spinner.jsx";
import { Check } from "lucide-react";

export function ExpenseForm({ expense, categories, onClose, onSave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(`/expenses${expense ? `/${expense.id}` : ""}`, {
        method: expense ? "PUT" : "POST",
        body: JSON.stringify({
          title: f.get("title"),
          amount: f.get("amount"),
          categoryId: Number(f.get("category")),
          date: f.get("date"),
          notes: f.get("notes"),
        }),
      });
      onSave(
        expense ? "Expense updated." : "Expense added. A little more clarity!",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={expense ? "Edit expense" : "Add an expense"}
      subtitle="The everyday things, all in one place."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save}>
        <ErrorText>{error}</ErrorText>
        <label>
          Description
          <input
            name="title"
            placeholder="e.g. Lunch with friends"
            maxLength={120}
            defaultValue={expense?.title}
            required
            autoFocus
          />
        </label>
        <div className="form-grid">
          <label>
            Amount (INR)
            <div className="amount-input">
              <span>₹</span>
              <input
                type="number"
                name="amount"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max="999999999.99"
                placeholder="0.00"
                defaultValue={
                  expense ? (expense.amountCents / 100).toFixed(2) : undefined
                }
                required
              />
            </div>
          </label>
          <label>
            Expense date
            <input
              type="date"
              name="date"
              min="1900-01-01"
              max="9999-12-31"
              defaultValue={expense?.date || localDate()}
              required
            />
          </label>
        </div>
        <p className="field-hint date-hint">
          When you spent it — even if you’re adding it today.
        </p>
        <label>
          Category
          <select
            name="category"
            defaultValue={expense?.categoryId || ""}
            required
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes <span className="optional">optional</span>
          <textarea
            name="notes"
            rows={3}
            maxLength={500}
            placeholder="Anything you’d like to remember…"
            defaultValue={expense?.notes}
          />
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || !categories.length}
          >
            {busy ? <Spinner /> : <Check size={17} />}
            {expense ? "Save changes" : "Add expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
