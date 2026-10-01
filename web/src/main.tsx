import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coffee,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  Category,
  dateLabel,
  Expense,
  localDate,
  money,
  rangeFor,
  RangeMode,
  Report,
  shiftAnchor,
  User,
} from "./lib";
import "./styles.css";

function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        p<span>·</span>
      </span>
      <span>
        penny<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function ErrorText({ children }: { children: React.ReactNode }) {
  return children ? (
    <div role="alert" className="error-message">
      {children}
    </div>
  ) : null;
}
function Spinner() {
  return <LoaderCircle className="spin" size={18} aria-label="Loading" />;
}

function Auth({ onAuth }: { onAuth: (u: User) => void }) {
  const [signup, setSignup] = useState(false),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      onAuth(
        await api<User>(`/auth/${signup ? "signup" : "signin"}`, {
          method: "POST",
          body: JSON.stringify({
            email: f.get("email"),
            password: f.get("password"),
            ...(signup ? { name: f.get("name") } : {}),
          }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow light">
            <span className="tiny-dot" /> A LITTLE CLARITY, EVERY DAY
          </span>
          <h1>
            Good days start
            <br />
            with a clearer
            <br />
            <em>picture.</em>
          </h1>
          <p>
            A home for your everyday expenses.
            <br />
            Less wondering. More knowing.
          </p>
          <div className="story-card">
            <div className="story-card-top">
              <span className="icon-tile">
                <Coffee size={22} />
              </span>
              <div>
                <strong>The little things add up.</strong>
                <span>Make room for what matters.</span>
              </div>
              <ArrowUpRight size={20} />
            </div>
            <div className="illustration-bars" aria-hidden="true">
              {[36, 62, 44, 80, 53, 96, 69, 110, 85, 124, 100, 146].map(
                (h, i) => (
                  <i key={i} style={{ height: h }} />
                ),
              )}
            </div>
            <div className="story-card-bottom">
              <span>YOUR EVERYDAY, IN PERSPECTIVE</span>
              <Leaf size={20} />
            </div>
          </div>
        </div>
        <div className="story-foot">
          <ShieldCheck size={16} /> Your expenses. Your space.
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">MEET YOUR MONEY, AGAIN</span>
          <h2>{signup ? "A fresh start." : "Welcome back."}</h2>
          <p className="muted">
            {signup
              ? "Create your account and make every expense count."
              : "A little check-in goes a long way."}
          </p>
          <div className="auth-tabs">
            <button
              className={!signup ? "selected" : ""}
              onClick={() => {
                setSignup(false);
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              className={signup ? "selected" : ""}
              onClick={() => {
                setSignup(true);
                setError("");
              }}
            >
              Create account
            </button>
          </div>
          <form onSubmit={submit} key={signup ? "up" : "in"}>
            <ErrorText>{error}</ErrorText>
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  placeholder="What should we call you?"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  name="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  placeholder={
                    signup ? "At least 10 characters" : "Enter your password"
                  }
                  minLength={signup ? 10 : undefined}
                  maxLength={72}
                  required
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {signup && (
              <p className="field-hint">
                Use a unique password with at least 10 characters.
              </p>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy ? (
                <Spinner />
              ) : (
                <>
                  {signup ? "Create your account" : "Sign in to Penny"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="auth-note">
            <ShieldCheck size={15} /> A private space for your personal
            spending.
          </p>
        </div>
        <span className="auth-copyright">
          Small steps. A little more peace of mind.
        </span>
      </section>
    </main>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose),
    busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first =
      ref.current?.querySelector<HTMLElement>("input, select, textarea") ||
      ref.current?.querySelector<HTMLElement>("button");
    first?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyRef.current) closeRef.current();
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ) || [],
        );
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">A LITTLE MORE ORGANIZED</span>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ExpenseForm({
  expense,
  categories,
  onClose,
  onSave,
}: {
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
  onSave: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
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
      setError((err as Error).message);
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
function CategoryForm({
  category,
  onClose,
  onSave,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: (message: string) => void;
}) {
  const [color, setColor] = useState(category?.color || palette[0]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
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
      setError((err as Error).message);
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

function ConfirmDelete({
  target,
  onClose,
  onSave,
}: {
  target: { type: "expenses" | "categories"; id: number; name: string };
  onClose: () => void;
  onSave: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/${target.type}/${target.id}`, { method: "DELETE" });
      onSave(
        target.type === "expenses" ? "Expense deleted." : "Category deleted.",
      );
    } catch (err) {
      setError((err as Error).message);
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

function App() {
  const [user, setUser] = useState<User | null>(null),
    [booting, setBooting] = useState(true),
    [bootError, setBootError] = useState("");
  function bootstrap() {
    setBooting(true);
    setBootError("");
    api<User>("/auth/me")
      .then(setUser)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401))
          setBootError(
            "We couldn’t reach Penny. The server may be waking up — please try again.",
          );
      })
      .finally(() => setBooting(false));
  }
  useEffect(bootstrap, []);
  if (booting)
    return (
      <main className="boot">
        <Brand />
        <Spinner />
        <p>Getting your space ready…</p>
      </main>
    );
  if (bootError)
    return (
      <main className="boot">
        <Brand />
        <p>{bootError}</p>
        <button className="button primary" onClick={bootstrap}>
          Try again
        </button>
      </main>
    );
  return user ? (
    <Dashboard user={user} onSignOut={() => setUser(null)} />
  ) : (
    <Auth onAuth={setUser} />
  );
}

function Dashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [view, setView] = useState<"overview" | "expenses" | "categories">(
    "overview",
  );
  const [categories, setCategories] = useState<Category[]>([]),
    [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState<RangeMode>("month"),
    [anchor, setAnchor] = useState(localDate()),
    [from, setFrom] = useState(localDate().slice(0, 7) + "-01"),
    [to, setTo] = useState(localDate()),
    [group, setGroup] = useState("day");
  const [yearDraft, setYearDraft] = useState(anchor.slice(0, 4));
  useEffect(() => setYearDraft(anchor.slice(0, 4)), [anchor]);
  const [search, setSearch] = useState(""),
    [debouncedSearch, setDebouncedSearch] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [toast, setToast] = useState(""),
    [exporting, setExporting] = useState(false);
  const [expenseModal, setExpenseModal] = useState<{
      expense: Expense | null;
    } | null>(null),
    [categoryModal, setCategoryModal] = useState<{
      category: Category | null;
    } | null>(null),
    [deleting, setDeleting] = useState<{
      type: "expenses" | "categories";
      id: number;
      name: string;
    } | null>(null);
  const [help, setHelp] = useState(false),
    [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const range = rangeFor(mode, anchor, from, to);
  const invalidRange =
    !anchor || (mode === "custom" && (!from || !to || from > to));
  const params = new URLSearchParams({ group, page: String(page) });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (category) params.set("category", category);
  if (debouncedSearch) params.set("q", debouncedSearch);
  const query = params.toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      invalidRange
        ? Promise.resolve(null)
        : api<Report>(`/expenses?${query}`, { signal: controller.signal }),
      api<Category[]>("/categories", { signal: controller.signal }),
    ])
      .then(([data, cats]) => {
        setReport(data);
        setCategories(cats);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (err instanceof ApiError && err.status === 401) onSignOut();
        else setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, refresh, invalidRange]);
  function saved(message: string) {
    setExpenseModal(null);
    setCategoryModal(null);
    setDeleting(null);
    setToast(message);
    setPage(1);
    setRefresh((x) => x + 1);
  }
  function changeMode(next: RangeMode) {
    setMode(next);
    setPage(1);
    if (next === "year") setGroup("month");
    else setGroup("day");
  }
  async function signout() {
    setSigningOut(true);
    try {
      await api("/auth/signout", { method: "POST", body: "{}" });
      onSignOut();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSigningOut(false);
    }
  }
  async function download() {
    setExporting(true);
    try {
      const res = await fetch(`/api/expenses/export?${query}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `penny-expenses-${range.from || "all"}-${range.to || localDate()}.csv`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast("Your expenses have been exported.");
    } catch (err) {
      setError((err as Error).message);
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
  const maxPeriod =
    display?.periods.reduce((max, p) => Math.max(max, p.amountCents), 1) || 1;
  const categoryTotal = report?.totalCents || 0;
  let angle = 0;
  const gradient = report?.categories
    .map((c) => {
      const start = angle;
      angle += categoryTotal ? (c.amountCents / categoryTotal) * 100 : 0;
      return `${c.color} ${start}% ${angle}%`;
    })
    .join(", ");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR PERSONAL SPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { key: "overview", label: "Overview", icon: LayoutDashboard },
              { key: "expenses", label: "All expenses", icon: Wallet },
              { key: "categories", label: "Categories", icon: Tags },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => {
                setView(key);
                if (key === "expenses") {
                  setMode("all");
                  setPage(1);
                }
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {view === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="gentle-note">
            <span className="leaf-circle">
              <Leaf size={22} />
            </span>
            <strong>
              Small habits.
              <br />
              Bigger peace of mind.
            </strong>
            <p>
              Checking in is a good start.
              <br />
              You’re already doing it.
            </p>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            <span>A little help</span>
            <ArrowUpRight size={15} />
          </button>
          <div className="user-profile">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <span>Personal account</span>
            </div>
            <button
              className="icon-button"
              onClick={signout}
              disabled={signingOut}
              aria-label="Sign out"
            >
              {signingOut ? <Spinner /> : <LogOut size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            My workspace <span>/</span>{" "}
            <strong>
              {view === "overview"
                ? "Overview"
                : view === "expenses"
                  ? "Expenses"
                  : "Categories"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="today">
              <CalendarDays size={15} />
              {dateLabel(localDate())}
            </span>
            <span className="currency-label">INR ₹</span>
          </div>
        </header>
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
              onClick={() => setRefresh((x) => x + 1)}
            >
              Try again
            </button>
          )}
          {view === "categories" ? (
            <>
              <section className="section-heading">
                <div>
                  <h2>
                    Your categories{" "}
                    <span className="count-pill">{categories.length}</span>
                  </h2>
                  <p>Start with the defaults. Add your own as life happens.</p>
                </div>
              </section>
              {loading && !categories.length ? (
                <div className="loading-panel">
                  <Spinner />
                  Loading categories…
                </div>
              ) : (
                <div className="category-grid">
                  {categories.map((c) => (
                    <article className="category-card" key={c.id}>
                      <div className="category-card-top">
                        <span
                          className="category-symbol"
                          style={{ background: `${c.color}20`, color: c.color }}
                        >
                          <Tags size={23} />
                        </span>
                        <span className="category-type">
                          {c.isDefault ? "DEFAULT" : "PERSONAL"}
                        </span>
                      </div>
                      <h3>{c.name}</h3>
                      <p>
                        {c.count} {c.count === 1 ? "expense" : "expenses"}
                      </p>
                      <div className="category-card-actions">
                        <button
                          onClick={() => setCategoryModal({ category: c })}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          aria-label={`Delete ${c.name}`}
                          onClick={() =>
                            setDeleting({
                              type: "categories",
                              id: c.id,
                              name: c.name,
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                  <button
                    className="new-category-card"
                    onClick={() => setCategoryModal({ category: null })}
                  >
                    <Plus size={26} />
                    <strong>Something else?</strong>
                    <span>Create your own category</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <section className="filter-bar" aria-label="Expense date filters">
                <div className="segmented">
                  {(
                    [
                      { key: "day", label: "Day" },
                      { key: "month", label: "Month" },
                      { key: "year", label: "Year" },
                      { key: "custom", label: "Custom" },
                      { key: "all", label: "All time" },
                    ] as const
                  ).map((v) => (
                    <button
                      key={v.key}
                      className={mode === v.key ? "selected" : ""}
                      aria-pressed={mode === v.key}
                      onClick={() => changeMode(v.key)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="date-navigation">
                  {mode === "custom" ? (
                    <>
                      <input
                        aria-label="Start date"
                        type="date"
                        min="1900-01-01"
                        max="9999-12-31"
                        value={from}
                        onChange={(e) => {
                          setFrom(e.target.value);
                          setPage(1);
                        }}
                      />
                      <span>to</span>
                      <input
                        aria-label="End date"
                        type="date"
                        min="1900-01-01"
                        max="9999-12-31"
                        value={to}
                        onChange={(e) => {
                          setTo(e.target.value);
                          setPage(1);
                        }}
                      />
                    </>
                  ) : mode !== "all" ? (
                    <>
                      <button
                        className="icon-button"
                        aria-label="Previous period"
                        disabled={
                          anchor.slice(0, 4) === "1900" &&
                          (mode === "year" ||
                            (anchor.slice(0, 7) === "1900-01" &&
                              (mode === "month" || anchor === "1900-01-01")))
                        }
                        onClick={() => {
                          setAnchor(shiftAnchor(anchor, mode, -1));
                          setPage(1);
                        }}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="date-control">
                        <CalendarDays size={16} />
                        {mode === "year" ? (
                          <input
                            aria-label="Year"
                            type="number"
                            min="1900"
                            max="9999"
                            value={yearDraft}
                            onChange={(e) => {
                              setYearDraft(e.target.value);
                              if (
                                e.target.value.length === 4 &&
                                Number(e.target.value) >= 1900 &&
                                Number(e.target.value) <= 9999
                              ) {
                                setAnchor(`${e.target.value}-01-01`);
                                setPage(1);
                              }
                            }}
                            onBlur={() => setYearDraft(anchor.slice(0, 4))}
                          />
                        ) : (
                          <input
                            aria-label={mode === "month" ? "Month" : "Day"}
                            type={mode === "month" ? "month" : "date"}
                            min={mode === "month" ? "1900-01" : "1900-01-01"}
                            max={mode === "month" ? "9999-12" : "9999-12-31"}
                            value={
                              mode === "month" ? anchor.slice(0, 7) : anchor
                            }
                            onChange={(e) => {
                              if (e.target.value) {
                                setAnchor(
                                  mode === "month"
                                    ? `${e.target.value}-01`
                                    : e.target.value,
                                );
                                setPage(1);
                              }
                            }}
                          />
                        )}
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Next period"
                        disabled={
                          anchor.slice(0, 4) === "9999" &&
                          (mode === "year" ||
                            (anchor.slice(0, 7) === "9999-12" &&
                              (mode === "month" || anchor === "9999-12-31")))
                        }
                        onClick={() => {
                          setAnchor(shiftAnchor(anchor, mode, 1));
                          setPage(1);
                        }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </>
                  ) : (
                    <span className="all-time-label">
                      <CalendarDays size={16} />
                      Your complete spending history
                    </span>
                  )}
                </div>
              </section>
              {invalidRange && (
                <ErrorText>
                  Choose a valid date range with the start on or before the end.
                </ErrorText>
              )}
              <div
                className={`report-content ${loading ? "is-loading" : ""}`}
                aria-busy={loading}
              >
                <section className="stats-grid">
                  <article className="stat-card primary-stat">
                    <div className="stat-label">
                      Total spent{" "}
                      <span>
                        <Wallet size={18} />
                      </span>
                    </div>
                    <strong>{display ? money(display.totalCents) : "—"}</strong>
                    <div className="stat-foot">
                      <span className="stat-pill">
                        {mode === "custom" && from && to
                          ? `${dateLabel(from)} – ${dateLabel(to)}`
                          : rangeTitle}
                      </span>
                      <span>INR</span>
                    </div>
                  </article>
                  <article className="stat-card">
                    <div className="stat-label">
                      Expenses recorded{" "}
                      <span className="stat-icon peach">
                        <ArrowDownLeft size={20} />
                      </span>
                    </div>
                    <strong>
                      {display ? display.count : "—"}
                      <small> expenses</small>
                    </strong>
                    <div className="stat-foot">
                      {display?.activeDays || 0} spending{" "}
                      {(display?.activeDays || 0) === 1 ? "day" : "days"} in
                      this period
                    </div>
                  </article>
                  <article className="stat-card">
                    <div className="stat-label">
                      Average per expense{" "}
                      <span className="stat-icon lavender">
                        <TrendingUp size={19} />
                      </span>
                    </div>
                    <strong>
                      {display
                        ? money(
                            display.count
                              ? Math.round(display.totalCents / display.count)
                              : 0,
                          )
                        : "—"}
                    </strong>
                    <div className="stat-foot">
                      A little perspective on your spending
                    </div>
                  </article>
                </section>
                {view === "overview" && (
                  <section className="insight-grid">
                    <article className="panel category-breakdown">
                      <div className="panel-heading">
                        <div>
                          <h2>Where it went</h2>
                          <p>Your spending, by category</p>
                        </div>
                        <span className="icon-muted">
                          <Tags size={19} />
                        </span>
                      </div>
                      {display && display.count > 0 ? (
                        <div className="breakdown-body">
                          <div
                            className="donut"
                            role="img"
                            aria-label="Category spending distribution; amounts listed alongside"
                            style={{
                              background: `conic-gradient(${gradient})`,
                            }}
                          >
                            <div className="donut-center">
                              <span>{display.categories.length}</span>
                              <small>categories</small>
                            </div>
                          </div>
                          <div className="category-legend">
                            {display.categories.map((c) => (
                              <div className="legend-row" key={c.name}>
                                <span
                                  className="legend-dot"
                                  style={{ background: c.color }}
                                />
                                <div>
                                  <span>{c.name}</span>
                                  <div className="legend-track">
                                    <i
                                      style={{
                                        width: `${(c.amountCents / display.totalCents) * 100}%`,
                                        background: c.color,
                                      }}
                                    />
                                  </div>
                                </div>
                                <strong>
                                  {money(c.amountCents)}
                                  <small>
                                    {Math.round(
                                      (c.amountCents / display.totalCents) *
                                        100,
                                    )}
                                    %
                                  </small>
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="insight-empty">
                          <div className="empty-donut">
                            <Leaf size={28} />
                          </div>
                          <p>
                            Your spending picture starts
                            <br />
                            with your first expense.
                          </p>
                        </div>
                      )}
                    </article>
                    <article className="panel period-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>A closer look</h2>
                          <p>Totals by expense date</p>
                        </div>
                        <select
                          aria-label="Group totals by"
                          value={group}
                          onChange={(e) => {
                            setGroup(e.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="day">By day</option>
                          <option value="month">By month</option>
                          <option value="year">By year</option>
                        </select>
                      </div>
                      {display && display.periods.length ? (
                        <div className="period-list">
                          {display.periods.map((p) => (
                            <div className="period-row" key={p.date}>
                              <div>
                                <span>{dateLabel(p.date, group)}</span>
                                <strong>{money(p.amountCents)}</strong>
                              </div>
                              <div className="period-track">
                                <i
                                  style={{
                                    width: `${(p.amountCents / maxPeriod) * 100}%`,
                                  }}
                                />
                              </div>
                              <small>
                                {p.count}{" "}
                                {p.count === 1 ? "expense" : "expenses"}
                              </small>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="insight-empty">
                          <BarChart3 size={44} strokeWidth={1} />
                          <p>
                            Your daily rhythms,
                            <br />a little easier to see.
                          </p>
                        </div>
                      )}
                      <div className="panel-footer">
                        <Sparkles size={14} /> Little details. A clearer
                        picture.
                      </div>
                    </article>
                  </section>
                )}
                <section className="panel expenses-panel">
                  <div className="panel-heading expenses-heading">
                    <div>
                      <h2>
                        {view === "expenses" ? "All expenses" : "Your expenses"}{" "}
                        <span className="count-pill">
                          {display?.count || 0}
                        </span>
                      </h2>
                      <p>Ordered by when you spent, not when you added.</p>
                    </div>
                    <button
                      className="button secondary export-button"
                      disabled={exporting || loading || !display?.count}
                      onClick={download}
                    >
                      {exporting ? <Spinner /> : <Download size={16} />}Export
                      CSV
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
                    <>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Expense</th>
                              <th>Category</th>
                              <th>Expense date</th>
                              <th className="amount-cell">Amount</th>
                              <th>
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {display.expenses.map((e) => (
                              <tr key={e.id}>
                                <td>
                                  <div className="expense-description">
                                    <span
                                      className="expense-icon"
                                      style={{
                                        color: e.color,
                                        background: `${e.color}18`,
                                      }}
                                    >
                                      <ArrowUpRight size={18} />
                                    </span>
                                    <div>
                                      <strong>{e.title}</strong>
                                      {e.notes && (
                                        <span title={e.notes}>{e.notes}</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span
                                    className="category-badge"
                                    style={{ background: `${e.color}18` }}
                                  >
                                    <i style={{ background: e.color }} />
                                    {e.category}
                                  </span>
                                </td>
                                <td className="date-cell">
                                  {dateLabel(e.date)}
                                </td>
                                <td className="amount-cell">
                                  {money(e.amountCents)}
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      className="icon-button"
                                      aria-label={`Edit ${e.title}`}
                                      onClick={() =>
                                        setExpenseModal({ expense: e })
                                      }
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      className="icon-button delete-button"
                                      aria-label={`Delete ${e.title}`}
                                      onClick={() =>
                                        setDeleting({
                                          type: "expenses",
                                          id: e.id,
                                          name: e.title,
                                        })
                                      }
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="table-footer">
                        <span>
                          Showing {(page - 1) * display.pageSize + 1}–
                          {Math.min(page * display.pageSize, display.count)} of{" "}
                          {display.count} expenses
                        </span>
                        <div>
                          <button
                            className="icon-button"
                            disabled={page === 1 || loading}
                            aria-label="Previous page"
                            onClick={() => setPage((p) => p - 1)}
                          >
                            <ChevronLeft size={17} />
                          </button>
                          <span>
                            Page {page} of{" "}
                            {Math.max(
                              1,
                              Math.ceil(display.count / display.pageSize),
                            )}
                          </span>
                          <button
                            className="icon-button"
                            disabled={
                              page * display.pageSize >= display.count ||
                              loading
                            }
                            aria-label="Next page"
                            onClick={() => setPage((p) => p + 1)}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                      </div>
                    </>
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
                        <button
                          className="button primary"
                          onClick={() => setExpenseModal({ expense: null })}
                        >
                          <Plus size={17} />
                          Add your first expense
                        </button>
                      )}
                    </div>
                  )}
                </section>
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
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
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
      {help && (
        <Modal title="A little help" onClose={() => setHelp(false)}>
          <div className="help-content">
            <h3>Your dates, your story</h3>
            <p>
              Reports use the expense date you choose. Add last week’s lunch
              today and it still belongs to last week.
            </p>
            <h3>Find your perspective</h3>
            <p>
              Switch between day, month, year, a custom inclusive date range, or
              all time. Search and category filters apply to totals, charts, and
              CSV exports together.
            </p>
            <h3>Make it personal</h3>
            <p>
              Use Categories to add, rename, or recolor a category. To delete a
              category that has expenses, edit those expenses and move them
              first.
            </p>
            <h3>Keep a copy</h3>
            <p>
              Export CSV downloads every matching expense, including rows on
              other pages. All amounts are in INR.
            </p>
            <h3>Your account</h3>
            <p>
              Use a unique password and sign out on shared devices. This first
              version has no email verification or password recovery, so keep
              your password in a safe place.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
