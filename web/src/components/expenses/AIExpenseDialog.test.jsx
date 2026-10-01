import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AIExpenseDialog } from "./AIExpenseDialog.jsx";
import {
  generateExpenseDrafts,
  saveExpenseBatch,
} from "../../api/expenseDrafts.js";

vi.mock("../../api/expenseDrafts.js", () => ({
  generateExpenseDrafts: vi.fn(),
  saveExpenseBatch: vi.fn(),
}));
const draft = {
  title: "Lunch",
  amount: "250.00",
  date: "2026-10-01",
  categoryId: 4,
  notes: null,
};
beforeEach(() => vi.resetAllMocks());
async function openDrafts(drafts = [draft]) {
  const onSave = vi.fn();
  generateExpenseDrafts.mockResolvedValue({ drafts });
  render(
    <AIExpenseDialog
      categories={[{ id: 4, name: "Food" }]}
      onClose={vi.fn()}
      onSave={onSave}
      onManual={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Your expenses"), {
    target: { value: "Lunch 250 yesterday" },
  });
  fireEvent.click(screen.getByText("Generate drafts"));
  await screen.findByText("Save expenses");
  return onSave;
}

it("reviews, edits, removes and saves only on confirmation", async () => {
  const onSave = await openDrafts([draft, { ...draft, title: "Cab" }]);
  expect(saveExpenseBatch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Remove expense 2"));
  fireEvent.change(screen.getByLabelText("Amount (INR)"), {
    target: { value: "300.50" },
  });
  saveExpenseBatch.mockResolvedValue({ ids: [1] });
  fireEvent.click(screen.getByText("Save expenses"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith("1 expense added."));
  expect(saveExpenseBatch.mock.calls[0][1]).toEqual([
    { ...draft, amount: "300.50", notes: "" },
  ]);
});

it("retries the identical batch after an uncertain network failure", async () => {
  await openDrafts();
  saveExpenseBatch
    .mockRejectedValueOnce(new Error("Network failed"))
    .mockResolvedValueOnce({ ids: [1] });
  fireEvent.click(screen.getByText("Save expenses"));
  await screen.findByText("Network failed");
  expect(
    screen.getByLabelText("Description").closest("fieldset").disabled,
  ).toBe(true);
  fireEvent.click(screen.getByText("Retry save"));
  await waitFor(() => expect(saveExpenseBatch).toHaveBeenCalledTimes(2));
  expect(saveExpenseBatch.mock.calls[1]).toEqual(
    saveExpenseBatch.mock.calls[0],
  );
});

it("keeps missing values blank and allows editing after validation rejection", async () => {
  await openDrafts([{ ...draft, amount: null }]);
  expect(screen.getByLabelText("Amount (INR)").value).toBe("");
  fireEvent.change(screen.getByLabelText("Amount (INR)"), {
    target: { value: "20" },
  });
  saveExpenseBatch.mockRejectedValue({
    status: 400,
    message: "Category is no longer available",
  });
  fireEvent.click(screen.getByText("Save expenses"));
  await screen.findByText("Category is no longer available");
  await waitFor(() =>
    expect(
      screen.getByLabelText("Description").closest("fieldset").disabled,
    ).toBe(false),
  );
});

it("handles empty extraction results", async () => {
  await openDrafts([]);
  expect(screen.getByText("Save expenses").disabled).toBe(true);
  expect(screen.getByText(/No expenses found/)).toBeTruthy();
});
