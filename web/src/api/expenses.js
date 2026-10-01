import { ApiError } from "./client.js";
import { localDate } from "../utils/dates.js";

export async function downloadExpenses(query, range) {
  const response = await fetch(`/api/expenses/export?${query}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || "Export failed", response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `penny-expenses-${range.from || "all"}-${range.to || localDate()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
