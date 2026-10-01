export type User = {
  id: number;
  name: string;
  email: string;
  currency: string;
};
export type Category = {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  count: number;
};
export type Expense = {
  id: number;
  title: string;
  amountCents: number;
  date: string;
  notes: string;
  categoryId: number;
  category: string;
  color: string;
};
export type Report = {
  expenses: Expense[];
  totalCents: number;
  count: number;
  activeDays: number;
  largestCents: number;
  categories: {
    name: string;
    color: string;
    amountCents: number;
    count: number;
  }[];
  periods: { date: string; amountCents: number; count: number }[];
  page: number;
  pageSize: number;
};
export type RangeMode = "day" | "month" | "year" | "custom" | "all";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.error || "Something went wrong. Please try again.",
      response.status,
    );
  return data as T;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function rangeFor(
  mode: RangeMode,
  anchor: string,
  start: string,
  end: string,
) {
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
export function shiftAnchor(anchor: string, mode: RangeMode, step: number) {
  const [y, m, d] = anchor.split("-").map(Number);
  if (mode === "month") return localDate(new Date(y, m - 1 + step, 1, 12));
  if (mode === "year") return localDate(new Date(y + step, 0, 1, 12));
  return localDate(new Date(y, m - 1, d + step, 12));
}
export const dateLabel = (date: string, group = "day") => {
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
