import { api } from "./client.js";

export function generateExpenseDrafts(text) {
  return api("/ai/expense-drafts", {
    method: "POST",
    body: JSON.stringify({
      text,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    }),
  });
}

export function saveExpenseBatch(requestId, expenses) {
  return api("/expenses/batch", {
    method: "POST",
    body: JSON.stringify({ requestId, expenses }),
  });
}
