import { Wallet, ArrowDownLeft, TrendingUp } from "lucide-react";
import { money } from "../../utils/money.js";
import { dateLabel } from "../../utils/dates.js";

export function SummaryCards({ display, mode, from, to, rangeTitle }) {
  return (
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
          {(display?.activeDays || 0) === 1 ? "day" : "days"} in this period
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
        <div className="stat-foot">A little perspective on your spending</div>
      </article>
    </section>
  );
}
