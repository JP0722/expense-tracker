import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client.js";

export function useExpenseData(query, invalidRange, onSessionExpired) {
  const [categories, setCategories] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    Promise.all([
      invalidRange
        ? Promise.resolve(null)
        : api(`/expenses?${query}`, { signal: controller.signal }),
      api("/categories", { signal: controller.signal }),
    ])
      .then(([data, cats]) => {
        if (controller.signal.aborted) return;
        setReport(data);
        setCategories(cats);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        else setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    // A filter change cancels the old request so it cannot overwrite newer data.
    return () => controller.abort();
  }, [query, invalidRange, revision, onSessionExpired]);

  function reload() {
    setRevision((value) => value + 1);
  }
  return { categories, report, loading, error, setError, reload };
}
