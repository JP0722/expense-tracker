import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useExpenseData } from "./useExpenseData.js";
import { api, ApiError } from "../api/client.js";

vi.mock("../api/client.js", async (original) => ({
  ...(await original()),
  api: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

describe("expense loading", () => {
  it("does not let a slow earlier request replace the current report", async () => {
    let finishOldRequest;
    api.mockImplementation((path) => {
      if (path === "/categories") return Promise.resolve([]);
      if (path.includes("page=1"))
        return new Promise((resolve) => {
          finishOldRequest = resolve;
        });
      return Promise.resolve({ count: 2 });
    });
    const onExpired = vi.fn();
    const { result, rerender } = renderHook(
      ({ query }) => useExpenseData(query, false, onExpired),
      { initialProps: { query: "page=1" } },
    );
    rerender({ query: "page=2" });
    await waitFor(() => expect(result.current.report).toEqual({ count: 2 }));
    await act(async () => finishOldRequest({ count: 1 }));
    expect(result.current.report).toEqual({ count: 2 });
  });

  it("loads categories without sending an invalid date range", async () => {
    api.mockResolvedValue([{ id: 1, name: "Food" }]);
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useExpenseData("from=invalid", true, onExpired),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.report).toBeNull();
    expect(result.current.categories).toHaveLength(1);
    expect(api.mock.calls.every(([path]) => path === "/categories")).toBe(true);
  });

  it("returns to sign-in when the session has expired", async () => {
    api.mockRejectedValue(new ApiError("Session expired", 401));
    const onExpired = vi.fn();
    renderHook(() => useExpenseData("page=1", false, onExpired));
    await waitFor(() => expect(onExpired).toHaveBeenCalledOnce());
  });
});
