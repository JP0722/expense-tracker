import { useRef, useState } from "react";
import {
  generateExpenseDrafts,
  saveExpenseBatch,
} from "../../api/expenseDrafts.js";
import { Modal } from "../ui/Modal.jsx";
import { ErrorText } from "../ui/ErrorText.jsx";
import { ExpenseDraftCard } from "./ExpenseDraftCard.jsx";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition.js";

export function AIExpenseDialog({ categories, onClose, onSave, onManual }) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const running = useRef(false);
  const speech = useSpeechRecognition((transcript) => {
    setText((current) => `${current.trim()} ${transcript.trim()}`.trim());
  });

  async function generate(event) {
    event.preventDefault();
    if (running.current || speech.listening || text.length > 2000) return;
    running.current = true;
    setBusy("generate");
    setError("");
    try {
      const result = await generateExpenseDrafts(text);
      setDrafts(
        result.drafts.map((draft) => ({ ...draft, key: crypto.randomUUID() })),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      running.current = false;
      setBusy("");
    }
  }

  async function save(event) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    setBusy("save");
    setError("");
    // Keep the exact payload and key after an uncertain failure. A retry cannot duplicate it.
    const batch = pending || {
      requestId: crypto.randomUUID(),
      expenses: drafts.map((draft) => ({
        title: draft.title,
        amount: draft.amount,
        date: draft.date,
        categoryId: Number(draft.categoryId),
        notes: draft.notes || "",
      })),
    };
    setPending(batch);
    try {
      await saveExpenseBatch(batch.requestId, batch.expenses);
      onSave(
        `${batch.expenses.length} expense${batch.expenses.length === 1 ? "" : "s"} added.`,
      );
    } catch (err) {
      // Validation/auth rejections did not commit; permit corrections. Network/5xx are uncertain.
      if (err.status >= 400 && err.status < 500 && err.status !== 409)
        setPending(null);
      setError(err.message);
    } finally {
      running.current = false;
      setBusy("");
    }
  }

  return (
    <Modal
      title="Add with AI"
      subtitle="Describe your spending, then review every expense."
      onClose={onClose}
      busy={Boolean(busy) || Boolean(pending)}
    >
      <ErrorText>{error}</ErrorText>
      {drafts === null ? (
        <form onSubmit={generate}>
          <label>
            Your expenses
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Yesterday, lunch ₹250 and a cab ₹180"
              required
              disabled={Boolean(busy) || speech.listening}
            />
          </label>
          {speech.supported ? (
            <button
              type="button"
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={speech.listening ? speech.stop : speech.start}
            >
              {speech.listening ? "Stop listening" : "Use microphone"}
            </button>
          ) : (
            <p className="field-hint">
              Voice input is unavailable in this browser. You can type your
              expenses.
            </p>
          )}
          {speech.listening && (
            <p role="status">
              Listening… Speak your expenses, then stop and review the text.
            </p>
          )}
          <ErrorText>{speech.error}</ErrorText>
          {text.length > 2000 && (
            <ErrorText>
              Shorten your text to 2,000 characters before generating drafts.
            </ErrorText>
          )}
          {speech.supported && (
            <p className="field-hint">
              Voice uses English (India). Your browser may send audio to its
              speech service. Check the transcript before continuing.
            </p>
          )}
          <p className="field-hint">
            Your text and category names are sent to Groq to suggest drafts.
            Nothing is saved until you confirm.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={onManual}
            >
              Use manual entry
            </button>
            <button
              className="button primary"
              disabled={
                Boolean(busy) ||
                speech.listening ||
                !text.trim() ||
                text.length > 2000
              }
            >
              {busy ? "Generating…" : "Generate drafts"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={save}>
          <p role="status">
            {drafts.length
              ? "Check the amounts, dates, and categories. Fill in any missing fields."
              : "No expenses found. Try adding a description and amount."}
          </p>
          {pending && !busy && (
            <>
              <p role="status">
                The save could not be confirmed. Retry the same batch to safely
                check or complete it. Before entering these expenses again,
                check your expense list.
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  onSave(
                    "Check your expense list before entering this batch again.",
                  )
                }
              >
                Close and check expenses
              </button>
            </>
          )}
          {drafts.map((draft, index) => (
            <ExpenseDraftCard
              key={draft.key}
              draft={draft}
              index={index}
              categories={categories}
              disabled={Boolean(busy) || Boolean(pending)}
              onChange={(name, value) =>
                setDrafts((current) =>
                  current.map((d) =>
                    d.key === draft.key ? { ...d, [name]: value } : d,
                  ),
                )
              }
              onRemove={() =>
                setDrafts((current) =>
                  current.filter((d) => d.key !== draft.key),
                )
              }
            />
          ))}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={Boolean(busy) || Boolean(pending)}
              onClick={() => {
                setDrafts(null);
                setError("");
              }}
            >
              Edit input
            </button>
            <button
              className="button primary"
              disabled={Boolean(busy) || !drafts.length || !categories.length}
            >
              {busy ? "Saving…" : pending ? "Retry save" : "Save expenses"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
