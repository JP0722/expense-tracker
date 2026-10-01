import { useEffect, useState } from "react";
import { localDate, rangeFor } from "../utils/dates.js";

// Filters are shared by the report, expense list, and CSV export.
export function useExpenseFilters() {
  const [mode, setMode] = useState("month");
  const [anchor, setAnchor] = useState(localDate());
  const [from, setFrom] = useState(localDate().slice(0, 7) + "-01");
  const [to, setTo] = useState(localDate());
  const [group, setGroup] = useState("day");
  const [yearDraft, setYearDraft] = useState(anchor.slice(0, 4));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => setYearDraft(anchor.slice(0, 4)), [anchor]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const range = rangeFor(mode, anchor, from, to);
  const invalidRange =
    !anchor || (mode === "custom" && (!from || !to || from > to));
  const params = new URLSearchParams({ group, page: String(page) });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (category) params.set("category", category);
  if (debouncedSearch) params.set("q", debouncedSearch);

  function changeMode(next) {
    setMode(next);
    setPage(1);
    setGroup(next === "year" ? "month" : "day");
  }

  return {
    mode,
    setMode,
    anchor,
    setAnchor,
    from,
    setFrom,
    to,
    setTo,
    group,
    setGroup,
    yearDraft,
    setYearDraft,
    search,
    setSearch,
    category,
    setCategory,
    page,
    setPage,
    range,
    invalidRange,
    query: params.toString(),
    changeMode,
  };
}
