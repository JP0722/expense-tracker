import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSpeechRecognition } from "./useSpeechRecognition.js";

afterEach(() => vi.unstubAllGlobals());
function install() {
  const sessions = [];
  class Recognition {
    constructor() { sessions.push(this); }
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
  }
  vi.stubGlobal("SpeechRecognition", Recognition);
  return sessions;
}

it("delivers final speech, stops listening, and allows another session", () => {
  const sessions = install();
  const callback = vi.fn();
  const { result, unmount } = renderHook(() => useSpeechRecognition(callback));
  act(() => result.current.start());
  act(() => result.current.start());
  expect(sessions).toHaveLength(1);
  expect(sessions[0].lang).toBe("en-IN");
  expect(result.current.listening).toBe(true);
  const final = Object.assign([{ transcript: "Lunch 250" }], { isFinal: true });
  act(() => sessions[0].onresult({ resultIndex: 0, results: [final] }));
  expect(callback).toHaveBeenCalledWith("Lunch 250");
  act(() => result.current.stop());
  expect(sessions[0].stop).toHaveBeenCalled();
  act(() => sessions[0].onend());
  expect(result.current.listening).toBe(false);
  act(() => result.current.start());
  unmount();
  expect(sessions[1].abort).toHaveBeenCalled();
  expect(sessions[1].onresult).toBeNull();
});

it("reports permission denial and preserves typing fallback", () => {
  const sessions = install();
  const { result } = renderHook(() => useSpeechRecognition(vi.fn()));
  act(() => result.current.start());
  act(() => { sessions[0].onerror({ error: "not-allowed" }); sessions[0].onend(); });
  expect(result.current.error).toContain("permission was denied");
  expect(result.current.listening).toBe(false);
});

it("detects unsupported browsers", () => {
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", undefined);
  const { result } = renderHook(() => useSpeechRecognition(vi.fn()));
  expect(result.current.supported).toBe(false);
  act(() => result.current.start());
  expect(result.current.listening).toBe(false);
});
