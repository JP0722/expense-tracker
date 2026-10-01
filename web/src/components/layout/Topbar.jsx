import { CalendarDays } from "lucide-react";
import { dateLabel, localDate } from "../../utils/dates.js";

export function Topbar({ view }) {
  return (
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
  );
}
