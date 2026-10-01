import { describe, expect, it } from "vitest";
import { dateLabel, localDate, rangeFor, shiftAnchor } from "./dates.js";
describe("expense calendar dates", () => {
  it("uses inclusive leap-year month boundaries", () => {
    expect(rangeFor("month", "2024-02-17", "", "")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
    expect(rangeFor("month", "2025-02-17", "", "")).toEqual({
      from: "2025-02-01",
      to: "2025-02-28",
    });
  });
  it("covers complete calendar years and exact custom ranges", () => {
    expect(rangeFor("year", "2024-06-17", "", "")).toEqual({
      from: "2024-01-01",
      to: "2024-12-31",
    });
    expect(rangeFor("custom", "", "2023-12-31", "2024-01-01")).toEqual({
      from: "2023-12-31",
      to: "2024-01-01",
    });
    expect(rangeFor("all", "", "", "")).toEqual({ from: "", to: "" });
    expect(rangeFor("day", "2024-02-29", "", "")).toEqual({
      from: "2024-02-29",
      to: "2024-02-29",
    });
  });
  it("navigates month ends without skipping February", () => {
    expect(shiftAnchor("2024-01-31", "month", 1)).toBe("2024-02-01");
    expect(shiftAnchor("2024-12-31", "month", 1)).toBe("2025-01-01");
    expect(shiftAnchor("2024-03-01", "day", -1)).toBe("2024-02-29");
    expect(shiftAnchor("2024-02-29", "year", 1)).toBe("2025-01-01");
  });
  it("formats local dates without UTC conversion", () => {
    expect(localDate(new Date(2024, 0, 1, 0, 5))).toBe("2024-01-01");
    expect(dateLabel("2024-01-01")).toContain("1 Jan 2024");
    expect(dateLabel("2024-02", "month")).toBe("February 2024");
  });
});
