import { shiftAnchor } from "../../utils/dates.js";
import { ChevronLeft, CalendarDays, ChevronRight } from "lucide-react";

export function DateFilters({ filters }) {
  const {
    mode,
    changeMode,
    from,
    to,
    setFrom,
    setTo,
    setPage,
    anchor,
    setAnchor,
    yearDraft,
    setYearDraft,
  } = filters;
  return (
    <section className="filter-bar" aria-label="Expense date filters">
      <div className="segmented">
        {[
          { key: "day", label: "Day" },
          { key: "month", label: "Month" },
          { key: "year", label: "Year" },
          { key: "custom", label: "Custom" },
          { key: "all", label: "All time" },
        ].map((v) => (
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
                  value={mode === "month" ? anchor.slice(0, 7) : anchor}
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
  );
}
