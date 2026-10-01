import {
  ArrowUpRight,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { dateLabel } from "../../utils/dates.js";
import { money } from "../../utils/money.js";

export function ExpenseTable({
  display,
  page,
  setPage,
  loading,
  onEdit,
  onDelete,
}) {
  return (
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
                      {e.notes && <span title={e.notes}>{e.notes}</span>}
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
                <td className="date-cell">{dateLabel(e.date)}</td>
                <td className="amount-cell">{money(e.amountCents)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${e.title}`}
                      onClick={() => onEdit(e)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button delete-button"
                      aria-label={`Delete ${e.title}`}
                      onClick={() => onDelete(e)}
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
          {Math.min(page * display.pageSize, display.count)} of {display.count}{" "}
          expenses
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
            {Math.max(1, Math.ceil(display.count / display.pageSize))}
          </span>
          <button
            className="icon-button"
            disabled={page * display.pageSize >= display.count || loading}
            aria-label="Next page"
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </>
  );
}
