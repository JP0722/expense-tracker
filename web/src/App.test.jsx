import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.jsx";
import { api, ApiError } from "./api/client.js";

vi.mock("./api/client.js", async (original) => ({
  ...(await original()),
  api: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

describe("session bootstrap", () => {
  it("shows sign-in when there is no saved session", async () => {
    api.mockRejectedValue(new ApiError("Please sign in", 401));
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "Sign in to Penny" }),
    ).toBeTruthy();
  });

  it("offers retry for a network failure and restores a valid session", async () => {
    const user = userEvent.setup();
    api.mockRejectedValueOnce(new Error("Network unavailable"));
    api.mockImplementation(async (path) => {
      if (path === "/auth/me")
        return { id: 1, name: "Alex", email: "alex@example.com" };
      if (path === "/categories") return [];
      return {
        expenses: [],
        totalCents: 0,
        count: 0,
        activeDays: 0,
        categories: [],
        periods: [],
        page: 1,
        pageSize: 25,
      };
    });
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "A little clarity, Alex." }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Add your first expense" }),
    ).toBeTruthy();
  });
});
