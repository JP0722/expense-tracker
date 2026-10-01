# Penny

A personal expense tracker built with Go, React (JavaScript/JSX), and MySQL. Vite builds the frontend, and Go serves the app and API.

## Included

- Email/password sign-up, sign-in, persistent sessions, and sign-out.
- Nine default categories for each account; add, rename, recolor, and delete your own categories. Categories with expenses cannot be deleted until those expenses are moved or removed.
- Add, edit, and delete expenses with a description, exact INR amount, **expense date**, category, and optional notes.
- AI expense entry from text or voice on supported browsers; review and edit drafts before saving them together. Requires a Groq API key. [Setup](docs/ai.md).
- Day, month, year, inclusive custom dates, and all-time views. Previous/next period navigation.
- Totals, average expense, category breakdown, and day/month/year grouped totals.
- Search descriptions and notes, filter by category, and browse paginated results. Summaries and CSV exports cover **all matching expenses**, not just the current page.
- Mobile layout, keyboard-accessible dialogs, empty/loading/error states, and CSV export.
- MySQL for deployment; persistent SQLite for zero-setup local development.
