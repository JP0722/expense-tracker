# Frontend guide

The frontend uses React with JavaScript and JSX. JSX is the HTML-like syntax inside a React component; these files do not use TypeScript.

## Where to start

1. `web/src/main.jsx` mounts the app and imports the styles.
2. `web/src/App.jsx` checks the current session and displays either the sign-in page or the dashboard.
3. `web/src/pages/AuthPage.jsx` handles sign-in and sign-up forms.
4. `web/src/pages/DashboardPage.jsx` connects the dashboard components, filters, and dialogs.

The dashboard switches between Overview, All expenses, and Categories using React state. It does not use a routing library.

## Folders

| Folder | Responsibility |
| --- | --- |
| `api/` | HTTP requests to Go and CSV downloads |
| `components/layout/` | Sidebar navigation and the top bar |
| `components/expenses/` | Expense form, date filters, search, table, and pagination |
| `components/categories/` | Category list and category form |
| `components/reports/` | Summary cards and spending breakdowns |
| `components/ui/` | Shared dialogs, loading indicators, error messages, and notifications |
| `hooks/` | Filter state and loading expenses/categories from the server |
| `utils/` | Calendar-date calculations and INR formatting |
| `styles/` | Shared, feature-specific, and responsive CSS |
| `test/` | Shared test setup |

Tests live beside the code they exercise, using `.test.js` or `.test.jsx` filenames.

## How adding an expense works

1. The Add expense button in `DashboardPage` opens `ExpenseForm`.
2. The form collects the description, amount, date, category, and notes.
3. On submission, it calls `api()` from `api/client.js` with a POST request.
4. Go validates and saves the expense, then returns JSON.
5. On success, the form calls the `onSave` callback passed by the dashboard.
6. The dashboard closes the form, shows a notification, and asks `useExpenseData` to reload.
7. React renders the updated totals and expense list. If saving fails, the form stays open and displays the error.

## How filters work

`useExpenseFilters` owns the selected dates, search text, category, grouping, and page. It uses the date helpers to build the API query. Search waits 250 milliseconds after typing before requesting another report.

`useExpenseData` fetches the report and categories when the query changes. It cancels the previous request so an old response cannot overwrite a newer report. The same query is used for CSV export.

Components receive data and callbacks through props. For example, `ExpenseTable` receives `onEdit` and `onDelete`; it asks the dashboard to open the appropriate dialog instead of managing dialogs itself.

## Commands

Run these from `web/` (use `npm.cmd` in PowerShell if `npm` is blocked):

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

For development, run `go run ./cmd/server` from the project root in a second terminal. Vite forwards `/api` requests to Go on port 8080.

The production build is still written to `web/dist`, which Go serves. The existing Dockerfile and Render setup use the same build command.
