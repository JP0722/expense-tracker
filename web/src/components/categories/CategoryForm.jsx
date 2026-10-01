import { useState } from "react";
import { api } from "../../api/client.js";
import { Modal } from "../ui/Modal.jsx";
import { ErrorText } from "../ui/ErrorText.jsx";
import { Check } from "lucide-react";
import { Spinner } from "../ui/Spinner.jsx";

const palette = [
  "#e29a55",
  "#7e9c62",
  "#6494b5",
  "#ad83b5",
  "#c4a24a",
  "#d37e88",
  "#798bc5",
  "#5eaaa0",
  "#929991",
  "#176a56",
];
export function CategoryForm({ category, onClose, onSave }) {
  const [color, setColor] = useState(category?.color || palette[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(`/categories${category ? `/${category.id}` : ""}`, {
        method: category ? "PUT" : "POST",
        body: JSON.stringify({ name: f.get("name"), color }),
      });
      onSave(category ? "Category updated." : "Your new category is ready.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={category ? "Edit category" : "Make it your own"}
      subtitle="Give your spending a place that makes sense to you."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save}>
        <ErrorText>{error}</ErrorText>
        <label>
          Category name
          <input
            name="name"
            placeholder="e.g. My side projects"
            maxLength={40}
            required
            defaultValue={category?.name}
            autoFocus
          />
        </label>
        <fieldset className="color-field">
          <legend>Choose a color</legend>
          <div className="color-picker">
            {palette.map((c) => (
              <button
                key={c}
                type="button"
                style={{ background: c }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
              >
                {color === c && <Check size={18} />}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Spinner /> : <Check size={17} />}Save category
          </button>
        </div>
      </form>
    </Modal>
  );
}
