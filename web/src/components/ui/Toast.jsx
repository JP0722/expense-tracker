import { Check, X } from "lucide-react";

export function Toast({ message, onDismiss }) {
  return (
    <div className="toast" role="status">
      <span>
        <Check size={16} />
      </span>
      {message}
      <button aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
