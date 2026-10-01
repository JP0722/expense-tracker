import { Spinner } from "../ui/Spinner.jsx";
import {
  Download,
  Search,
  X,
  CircleHelp,
  FolderOpen,
  Plus,
} from "lucide-react";
import { ExpenseTable } from "./ExpenseTable.jsx";

export function ExpensesPanel({
  view,
  display,
  report,
  loading,
  filters,
  exporting,
  onExport,
  onAdd,
  onEdit,
  onDelete,
  categories,
}) {
  const {
    search,
    setSearch,
    category,
    setCategory,
    page,
    setPage,
    invalidRange,
  } = filters;
  return (
    <section className="panel expenses-panel">
      <div className="panel-heading expenses-heading">
        <div>
          <h2>
            {view === "expenses" ? "All expenses" : "Your expenses"}{" "}
            <span className="count-pill">{display?.count || 0}</span>
          </h2>
          <p>Ordered by when you spent, not when you added.</p>
        </div>
        <button
          className="button secondary export-button"
          disabled={exporting || loading || !display?.count}
          onClick={onExport}
        >
          {exporting ? <Spinner /> : <Download size={16} />}Export CSV
        </button>
      </div>
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search expenses"
            placeholder="Search descriptions or notes…"
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(search || category) && (
          <button
            className="text-button"
            onClick={() => {
              setSearch("");
              setCategory("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      {loading && !report ? (
        <div className="loading-panel">
          <Spinner />
          Gathering your expenses…
        </div>
      ) : !display ? (
        <div className="empty-state">
          <CircleHelp size={30} />
          <h3>Your report isn’t ready.</h3>
          <p>
            {invalidRange
              ? "Choose valid dates to see your expenses."
              : "Try again to load your expenses."}
          </p>
        </div>
      ) : display.expenses.length ? (
        <ExpenseTable
          display={display}
          page={page}
          setPage={setPage}
          loading={loading}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <FolderOpen size={30} />
          </span>
          <h3>
            {search || category
              ? "No matching expenses."
              : "A clean page. A fresh perspective."}
          </h3>
          <p>
            {search || category
              ? "Try another search or category."
              : "No expenses in this period. Add one whenever you’re ready."}
          </p>
          {search || category ? (
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setCategory("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          ) : (
            <button className="button primary" onClick={onAdd}>
              <Plus size={17} />
              Add your first expense
            </button>
          )}
        </div>
      )}
    </section>
  );
}
