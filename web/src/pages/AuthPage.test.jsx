import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthPage } from "./AuthPage.jsx";
import { api, ApiError } from "../api/client.js";

vi.mock("../api/client.js", async (original) => ({
  ...(await original()),
  api: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

describe("authentication forms", () => {
  it("signs in and passes the authenticated user to the app", async () => {
    const user = userEvent.setup();
    const account = { id: 1, name: "Alex", email: "alex@example.com" };
    api.mockResolvedValue(account);
    const onAuth = vi.fn();
    render(<AuthPage onAuth={onAuth} />);
    await user.type(screen.getByLabelText("Email address"), account.email);
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in to Penny" }));
    expect(api).toHaveBeenCalledWith(
      "/auth/signin",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: account.email,
          password: "correct-password",
        }),
      }),
    );
    await waitFor(() => expect(onAuth).toHaveBeenCalledWith(account));
  });

  it("includes the name when creating an account", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 1 });
    render(<AuthPage onAuth={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByLabelText("Your name"), "Alex");
    await user.type(screen.getByLabelText("Email address"), "alex@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(
      screen.getByRole("button", { name: "Create your account" }),
    );
    const [path, options] = api.mock.calls[0];
    expect(path).toBe("/auth/signup");
    expect(JSON.parse(options.body)).toEqual({
      name: "Alex",
      email: "alex@example.com",
      password: "correct-password",
    });
  });

  it("keeps the form open and displays server errors", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(new ApiError("Email or password is incorrect", 401));
    const onAuth = vi.fn();
    render(<AuthPage onAuth={onAuth} />);
    await user.type(screen.getByLabelText("Email address"), "alex@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in to Penny" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Email or password is incorrect",
    );
    expect(onAuth).not.toHaveBeenCalled();
  });
});
