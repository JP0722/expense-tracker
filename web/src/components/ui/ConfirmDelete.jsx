import { useState } from "react";
import { api } from "../../api/client.js";
import { Modal } from "./Modal.jsx";
import { ErrorText } from "./ErrorText.jsx";
import { Spinner } from "./Spinner.jsx";
import { Trash2 } from "lucide-react";

export function ConfirmDelete({ target, onClose, onSave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/${target.type}/${target.id}`, { method: "DELETE" });
      onSave(
        target.type === "expenses" ? "Expense deleted." : "Category deleted.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Delete ${target.type === "expenses" ? "expense" : "category"}?`}
      onClose={onClose}
      busy={busy}
    >
      <ErrorText>{error}</ErrorText>
      <p className="delete-copy">
        “{target.name}” will be permanently removed. This cannot be undone.
      </p>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose} disabled={busy}>
          Keep it
        </button>
        <button className="button danger" onClick={remove} disabled={busy}>
          {busy ? <Spinner /> : <Trash2 size={17} />}Delete
        </button>
      </div>
    </Modal>
  );
}
