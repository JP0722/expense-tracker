import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPage } from "./DashboardPage.jsx";
import { api } from "../api/client.js";
import { downloadExpenses } from "../api/expenses.js";

vi.mock("../api/client.js", async (original) => ({
  ...(await original()),
  api: vi.fn(),
}));
vi.mock("../api/expenses.js", () => ({ downloadExpenses: vi.fn() }));
const account = { name: "Alex", email: "alex@example.com" };
const categories = [
  { id: 1, name: "Food", color: "#e29a55", count: 1, isDefault: true },
];
const expense = {
  id: 7,
  title: "Lunch",
  amountCents: 35000,
  date: "2024-02-29",
  categoryId: 1,
  category: "Food",
  color: "#e29a55",
  notes: "Cafe",
};
const report = {
  expenses: [expense],
  totalCents: 35000,
  count: 1,
  activeDays: 1,
  largestCents: 35000,
  categories: [
    { name: "Food", color: "#e29a55", amountCents: 35000, count: 1 },
  ],
  periods: [{ date: "2024-02-29", amountCents: 35000, count: 1 }],
  page: 1,
  pageSize: 25,
};
beforeEach(() => {
  vi.clearAllMocks();
  api.mockImplementation(async (path, options) => {
    if (options?.method) return { ok: true };
    if (path === "/categories") return categories;
    return report;
  });
  downloadExpenses.mockResolvedValue();
});

describe("dashboard integration", () => {
  it("connects date, search, and category filters to the report and export", async () => {
    const user = userEvent.setup();
    render(<DashboardPage user={account} onSignOut={vi.fn()} />);
    await screen.findByText("Lunch");
    await user.click(
      screen.getByRole("button", { name: "Custom", exact: true }),
    );
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2024-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2024-02-29" },
    });
    await user.selectOptions(screen.getByLabelText("Filter by category"), "1");
    await user.type(screen.getByLabelText("Search expenses"), "Lunch");
    await waitFor(() =>
      expect(
        api.mock.calls.some(
          ([path]) =>
            path.includes("from=2024-02-01") &&
            path.includes("to=2024-02-29") &&
            path.includes("category=1") &&
            path.includes("q=Lunch"),
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Export CSV" }).disabled).toBe(
        false,
      ),
    );
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    const [query, range] = downloadExpenses.mock.calls[0];
    expect(new URLSearchParams(query).get("q")).toBe("Lunch");
    expect(range).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("opens editing and deletion dialogs and reloads after deleting", async () => {
    const user = userEvent.setup();
    render(<DashboardPage user={account} onSignOut={vi.fn()} />);
    await screen.findByText("Lunch");
    await user.click(screen.getByRole("button", { name: "Edit Lunch" }));
    expect(screen.getByLabelText("Description").value).toBe("Lunch");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete Lunch" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete", exact: true }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/expenses/7", { method: "DELETE" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status").textContent).toContain("Expense deleted");
  });

  it("supports category creation, all-time navigation, help, and signout", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(<DashboardPage user={account} onSignOut={onSignOut} />);
    await screen.findByText("Lunch");
    await user.click(
      screen.getByRole("button", { name: "Categories", exact: true }),
    );
    await user.click(screen.getByRole("button", { name: "New category" }));
    await user.type(screen.getByLabelText("Category name"), "Books");
    await user.click(screen.getByRole("button", { name: "Color #7e9c62" }));
    await user.click(screen.getByRole("button", { name: "Save category" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Books", color: "#7e9c62" }),
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "All expenses", exact: true }),
    );
    expect(
      screen
        .getByRole("button", { name: "All time", exact: true })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await user.click(screen.getByRole("button", { name: "A little help" }));
    expect(screen.getByRole("dialog").textContent).toContain(
      "Your dates, your story",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(onSignOut).toHaveBeenCalled());
  });
});
