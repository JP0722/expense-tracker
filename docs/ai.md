# AI expense entry

Use **Add with AI** on the dashboard to type or speak expenses, generate drafts, edit or remove them, and confirm saving.

## Voice input

On supported browsers over HTTPS or localhost, **Use microphone** starts browser speech recognition in English (India). Stop listening, review the editable transcript, and generate drafts. Closing the dialog stops microphone recognition. Permission denial, missing microphones, and recognition errors leave typing available. Browser support varies; the browser may send audio to its own speech service and require internet access. Penny sends only the reviewed text to Groq, not audio. No separate transcription API key is required.

Set `GROQ_API_KEY` in your local `.env` or Render environment and restart the server. `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`; overrides must support strict structured outputs. Never commit the key. Without a key, manual entry still works and the AI endpoint returns 503.

## Request

`POST /api/ai/expense-drafts` requires the existing session cookie and JSON content type. The same origin checks as expense creation apply.

```json
{"text":"Lunch 250 yesterday","timezone":"Asia/Kolkata"}
```

Text is limited to 2,000 characters within the existing 8 KiB request-body limit. The server calculates today's date using the supplied timezone and loads up to 100 of the signed-in user's categories. Only text, date context, and category IDs/names go to the provider.

The response is `{"drafts":[...]}`. Each draft has `title`, `amount` (decimal INR string), `date` (YYYY-MM-DD), `categoryId`, and `notes`. Missing fields are null. Empty results use an empty array. Populated fields are validated using expense constraints; unexpected category IDs or invalid values reject the response. Nothing is saved.

## Usage and failures

- 5 attempts per user per 15-minute window.
- 20 provider attempts per user and 100 per server process per UTC day. Failed provider attempts count too.
- Limits are in memory: restarting resets them and multiple instances have separate counters. They do not guarantee staying within a provider token quota.
- A 15-second extraction deadline and the client's timeout bound waiting.
- 400: invalid input; 401: missing/expired session; 429: local/provider limit; 502: invalid model response; 503: disabled/unavailable; 504: extraction deadline exceeded. The client's own HTTP timeout can surface as 503.
- Local limits return Retry-After. Provider quota errors do not invent a reset time.

Review `internal/ai/client.go`, then `internal/app/ai_expenses.go`, the route/option in `server.go`, and configuration in `cmd/server/main.go`. Tests inject a fake extractor and never call Groq. Live model accuracy still needs checking with synthetic examples and an API key.

## Review and save

`AIExpenseDialog.jsx` handles input and review; `ExpenseDraftCard.jsx` contains editable fields. `api/expenseDrafts.js` calls the backend. Missing fields stay blank and must be completed before saving. Manual entry remains available when AI is disabled or unavailable.

`POST /api/expenses/batch` accepts `{ "requestId": "a-unique-uuid", "expenses": [...] }` using the existing expense field names. It accepts 1–10 expenses and at most 64 KiB of JSON, validates every expense, and checks category ownership. A transaction inserts the expenses and a receipt in the new `expense_batches` table, which is created automatically on startup for SQLite and MySQL.

The receipt is scoped to the signed-in user. An identical retry returns the original IDs (200); a new save returns 201. Reusing a request ID with a different normalized payload returns 409. Receipts persist across restarts and are not automatically expired. A failed transaction leaves neither expenses nor a receipt.

On an uncertain network/server failure, the dialog freezes the submitted batch and retries with the same request ID and payload. Validation errors allow editing. If you close after an uncertain save, inspect your expense list before entering the batch again. Successful saving refreshes the dashboard; expenses outside the current date filter may not appear in that view.
