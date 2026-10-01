import { dateLabel } from "../../utils/dates.js";
import { money } from "../../utils/money.js";
import { BarChart3, Sparkles } from "lucide-react";

export function PeriodBreakdown({ display, group, onGroupChange }) {
  const maxPeriod =
    display?.periods.reduce((max, p) => Math.max(max, p.amountCents), 1) || 1;
  return (
    <article className="panel period-panel">
      <div className="panel-heading">
        <div>
          <h2>A closer look</h2>
          <p>Totals by expense date</p>
        </div>
        <select
          aria-label="Group totals by"
          value={group}
          onChange={(e) => onGroupChange(e.target.value)}
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
                {p.count} {p.count === 1 ? "expense" : "expenses"}
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
        <Sparkles size={14} /> Little details. A clearer picture.
      </div>
    </article>
  );
}
