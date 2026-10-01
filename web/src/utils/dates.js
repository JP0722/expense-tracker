export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function rangeFor(mode, anchor, start, end) {
  if (mode === "all") return { from: "", to: "" };
  if (mode === "custom") return { from: start, to: end };
  if (mode === "day") return { from: anchor, to: anchor };
  if (mode === "year")
    return {
      from: `${anchor.slice(0, 4)}-01-01`,
      to: `${anchor.slice(0, 4)}-12-31`,
    };
  const [y, m] = anchor.split("-").map(Number);
  return {
    from: `${anchor.slice(0, 7)}-01`,
    to: localDate(new Date(y, m, 0, 12)),
  };
}

export function shiftAnchor(anchor, mode, step) {
  const [y, m, d] = anchor.split("-").map(Number);
  if (mode === "month") return localDate(new Date(y, m - 1 + step, 1, 12));
  if (mode === "year") return localDate(new Date(y + step, 0, 1, 12));
  return localDate(new Date(y, m - 1, d + step, 12));
}

export const dateLabel = (date, group = "day") => {
  const full =
    date.length === 4
      ? `${date}-01-01`
      : date.length === 7
        ? `${date}-01`
        : date;
  const parsed = new Date(`${full}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(
    "en-IN",
    group === "year"
      ? { year: "numeric" }
      : group === "month"
        ? { month: "long", year: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" },
  );
};
