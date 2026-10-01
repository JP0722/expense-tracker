import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseForm } from "./ExpenseForm.jsx";
import { api } from "../../api/client.js";

vi.mock("../../api/client.js", () => ({ api: vi.fn() }));
const categories = [{ id: 4, name: "Groceries", color: "#7e9c62" }];
beforeEach(() => vi.clearAllMocks());

describe("expense form", () => {
  it("saves an explicit backdated date and decimal string", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    api.mockResolvedValue({ id: 1 });
    render(
      <ExpenseForm
        expense={null}
        categories={categories}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    await user.type(screen.getByLabelText("Description"), "Weekly groceries");
    await user.type(screen.getByLabelText(/Amount \(INR\)/), "123.45");
    fireEvent.change(screen.getByLabelText("Expense date"), {
      target: { value: "2024-02-29" },
    });
    await user.selectOptions(screen.getByLabelText("Category"), "4");
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    expect(api).toHaveBeenCalledWith("/expenses", {
      method: "POST",
      body: JSON.stringify({
        title: "Weekly groceries",
        amount: "123.45",
        categoryId: 4,
        date: "2024-02-29",
        notes: "",
      }),
    });
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it("prepopulates an expense and uses PUT when editing", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ ok: true });
    const expense = {
      id: 9,
      title: "Milk",
      amountCents: 6050,
      categoryId: 4,
      date: "2024-01-02",
      notes: "Weekly",
    };
    render(
      <ExpenseForm
        expense={expense}
        categories={categories}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Amount \(INR\)/).value).toBe("60.50");
    expect(screen.getByLabelText("Expense date").value).toBe("2024-01-02");
    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Milk and bread");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(api.mock.calls[0][0]).toBe("/expenses/9");
    expect(api.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(api.mock.calls[0][1].body).title).toBe("Milk and bread");
  });

  it("shows a save failure without closing the dialog", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(new Error("Could not save your data"));
    const onSave = vi.fn();
    render(
      <ExpenseForm
        expense={{
          id: 1,
          title: "Milk",
          amountCents: 500,
          date: "2024-01-01",
          categoryId: 4,
          notes: "",
        }}
        categories={categories}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not save",
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
