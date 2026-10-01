import { Tags, Leaf } from "lucide-react";
import { money } from "../../utils/money.js";

export function CategoryBreakdown({ display }) {
  const categoryTotal = display?.totalCents || 0;
  let angle = 0;
  const gradient = display?.categories
    .map((c) => {
      const start = angle;
      angle += categoryTotal ? (c.amountCents / categoryTotal) * 100 : 0;
      return `${c.color} ${start}% ${angle}%`;
    })
    .join(", ");

  return (
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
                <span className="legend-dot" style={{ background: c.color }} />
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
                    {Math.round((c.amountCents / display.totalCents) * 100)}%
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
  );
}
