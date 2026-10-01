import { Modal } from "./Modal.jsx";

export function HelpDialog({ onClose }) {
  return (
    <Modal title="A little help" onClose={onClose}>
      <div className="help-content">
        <h3>Your dates, your story</h3>
        <p>
          Reports use the expense date you choose. Add last week’s lunch today
          and it still belongs to last week.
        </p>
        <h3>Find your perspective</h3>
        <p>
          Switch between day, month, year, a custom inclusive date range, or all
          time. Search and category filters apply to totals, charts, and CSV
          exports together.
        </p>
        <h3>Make it personal</h3>
        <p>
          Use Categories to add, rename, or recolor a category. To delete a
          category that has expenses, edit those expenses and move them first.
        </p>
        <h3>Keep a copy</h3>
        <p>
          Export CSV downloads every matching expense, including rows on other
          pages. All amounts are in INR.
        </p>
        <h3>Your account</h3>
        <p>
          Use a unique password and sign out on shared devices. This first
          version has no email verification or password recovery, so keep your
          password in a safe place.
        </p>
      </div>
    </Modal>
  );
}
