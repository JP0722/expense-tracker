import { useExpenseFilters } from "../hooks/useExpenseFilters.js";
import { useExpenseData } from "../hooks/useExpenseData.js";
import { useState, useEffect } from "react";
import { api } from "../api/client.js";
import { downloadExpenses } from "../api/expenses.js";
import { dateLabel } from "../utils/dates.js";
import { Sidebar } from "../components/layout/Sidebar.jsx";
import { Topbar } from "../components/layout/Topbar.jsx";
import { Plus, ShieldCheck, Leaf } from "lucide-react";
import { ErrorText } from "../components/ui/ErrorText.jsx";
import { CategoryList } from "../components/categories/CategoryList.jsx";
import { DateFilters } from "../components/expenses/DateFilters.jsx";
import { SummaryCards } from "../components/reports/SummaryCards.jsx";
import { CategoryBreakdown } from "../components/reports/CategoryBreakdown.jsx";
import { PeriodBreakdown } from "../components/reports/PeriodBreakdown.jsx";
import { ExpensesPanel } from "../components/expenses/ExpensesPanel.jsx";
import { Toast } from "../components/ui/Toast.jsx";
import { ExpenseForm } from "../components/expenses/ExpenseForm.jsx";
import { CategoryForm } from "../components/categories/CategoryForm.jsx";
import { ConfirmDelete } from "../components/ui/ConfirmDelete.jsx";
import { HelpDialog } from "../components/ui/HelpDialog.jsx";

export function DashboardPage({ user, onSignOut }) {
  const filters = useExpenseFilters();
  const {
    mode,
    anchor,
    from,
    to,
    group,
    category,
    range,
    query,
    invalidRange,
    setMode,
    setGroup,
    setCategory,
    setPage,
  } = filters;
  const { categories, report, loading, error, setError, reload } =
    useExpenseData(query, invalidRange, onSignOut);
  function navigate(nextView) {
    setView(nextView);
    if (nextView === "expenses") {
      setMode("all");
      setPage(1);
    }
  }
  const [view, setView] = useState("overview");
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);
  const [expenseModal, setExpenseModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [help, setHelp] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  function saved(message) {
    setExpenseModal(null);
    setCategoryModal(null);
    setDeleting(null);
    setToast(message);
    setPage(1);
    reload();
  }
  async function signout() {
    setSigningOut(true);
    try {
      await api("/auth/signout", { method: "POST", body: "{}" });
      onSignOut();
    } catch (err) {
      setError(err.message);
    } finally {
      setSigningOut(false);
    }
  }
  async function download() {
    setExporting(true);
    try {
      await downloadExpenses(query, range);
      setToast("Your expenses have been exported.");
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }
  const title =
    view === "categories"
      ? "A place for everything."
      : view === "expenses"
        ? "Your everyday, recorded."
        : `A little clarity, ${user.name.split(" ")[0]}.`;
  const rangeTitle =
    mode === "all"
      ? "All time"
      : mode === "custom"
        ? "Your date range"
        : dateLabel(anchor, mode);
  const dataReady = report && !invalidRange && !error;
  const display = dataReady ? report : null;
  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        view={view}
        onNavigate={navigate}
        onHelp={() => setHelp(true)}
        onSignOut={signout}
        signingOut={signingOut}
      />
      <div className="main-shell">
        <Topbar view={view} />
        <main className="dashboard">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-dot" /> YOUR MONEY, MADE CLEAR
              </div>
              <h1>{title}</h1>
              <p className="muted">
                {view === "categories"
                  ? "Organize your spending in a way that feels like you."
                  : "Every expense has a story. Here’s the bigger picture."}
              </p>
            </div>
            <button
              className="button primary"
              onClick={() =>
                view === "categories"
                  ? setCategoryModal({ category: null })
                  : setExpenseModal({ expense: null })
              }
            >
              <Plus size={18} />
              {view === "categories" ? "New category" : "Add expense"}
            </button>
          </section>
          <ErrorText>{error}</ErrorText>
          {error && (
            <button
              className="button secondary retry-button"
              onClick={() => reload()}
            >
              Try again
            </button>
          )}
          {view === "categories" ? (
            <CategoryList
              categories={categories}
              loading={loading}
              onAdd={() => setCategoryModal({ category: null })}
              onEdit={(category) => setCategoryModal({ category })}
              onDelete={(category) =>
                setDeleting({
                  type: "categories",
                  id: category.id,
                  name: category.name,
                })
              }
            />
          ) : (
            <>
              <DateFilters filters={filters} />
              {invalidRange && (
                <ErrorText>
                  Choose a valid date range with the start on or before the end.
                </ErrorText>
              )}
              <div
                className={`report-content ${loading ? "is-loading" : ""}`}
                aria-busy={loading}
              >
                <SummaryCards
                  display={display}
                  mode={mode}
                  from={from}
                  to={to}
                  rangeTitle={rangeTitle}
                />
                {view === "overview" && (
                  <section className="insight-grid">
                    <CategoryBreakdown display={display} />
                    <PeriodBreakdown
                      display={display}
                      group={group}
                      onGroupChange={(group) => {
                        setGroup(group);
                        setPage(1);
                      }}
                    />
                  </section>
                )}
                <ExpensesPanel
                  view={view}
                  display={display}
                  report={report}
                  loading={loading}
                  filters={filters}
                  exporting={exporting}
                  onExport={download}
                  categories={categories}
                  onAdd={() => setExpenseModal({ expense: null })}
                  onEdit={(expense) => setExpenseModal({ expense })}
                  onDelete={(expense) =>
                    setDeleting({
                      type: "expenses",
                      id: expense.id,
                      name: expense.title,
                    })
                  }
                />
              </div>
              <div className="dashboard-footer">
                <span>
                  <ShieldCheck size={14} /> Just your expenses. Just for you.
                </span>
                <span>
                  One small step at a time <Leaf size={13} />
                </span>
              </div>
            </>
          )}
        </main>
      </div>
      {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
      {expenseModal && (
        <ExpenseForm
          expense={expenseModal.expense}
          categories={categories}
          onClose={() => setExpenseModal(null)}
          onSave={saved}
        />
      )}
      {categoryModal && (
        <CategoryForm
          category={categoryModal.category}
          onClose={() => setCategoryModal(null)}
          onSave={saved}
        />
      )}
      {deleting && (
        <ConfirmDelete
          target={deleting}
          onClose={() => setDeleting(null)}
          onSave={(message) => {
            if (
              deleting.type === "categories" &&
              category === String(deleting.id)
            )
              setCategory("");
            saved(message);
          }}
        />
      )}
      {help && <HelpDialog onClose={() => setHelp(false)} />}
    </div>
  );
}
