import { useState } from "react";
import { api } from "../api/client.js";
import { Brand } from "../components/ui/Brand.jsx";
import {
  Coffee,
  ArrowUpRight,
  Leaf,
  ShieldCheck,
  EyeOff,
  Eye,
  ArrowRight,
} from "lucide-react";
import { ErrorText } from "../components/ui/ErrorText.jsx";
import { Spinner } from "../components/ui/Spinner.jsx";

export function AuthPage({ onAuth }) {
  const [signup, setSignup] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      onAuth(
        await api(`/auth/${signup ? "signup" : "signin"}`, {
          method: "POST",
          body: JSON.stringify({
            email: f.get("email"),
            password: f.get("password"),
            ...(signup ? { name: f.get("name") } : {}),
          }),
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow light">
            <span className="tiny-dot" /> A LITTLE CLARITY, EVERY DAY
          </span>
          <h1>
            Good days start
            <br />
            with a clearer
            <br />
            <em>picture.</em>
          </h1>
          <p>
            A home for your everyday expenses.
            <br />
            Less wondering. More knowing.
          </p>
          <div className="story-card">
            <div className="story-card-top">
              <span className="icon-tile">
                <Coffee size={22} />
              </span>
              <div>
                <strong>The little things add up.</strong>
                <span>Make room for what matters.</span>
              </div>
              <ArrowUpRight size={20} />
            </div>
            <div className="illustration-bars" aria-hidden="true">
              {[36, 62, 44, 80, 53, 96, 69, 110, 85, 124, 100, 146].map(
                (h, i) => (
                  <i key={i} style={{ height: h }} />
                ),
              )}
            </div>
            <div className="story-card-bottom">
              <span>YOUR EVERYDAY, IN PERSPECTIVE</span>
              <Leaf size={20} />
            </div>
          </div>
        </div>
        <div className="story-foot">
          <ShieldCheck size={16} /> Your expenses. Your space.
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">MEET YOUR MONEY, AGAIN</span>
          <h2>{signup ? "A fresh start." : "Welcome back."}</h2>
          <p className="muted">
            {signup
              ? "Create your account and make every expense count."
              : "A little check-in goes a long way."}
          </p>
          <div className="auth-tabs">
            <button
              className={!signup ? "selected" : ""}
              onClick={() => {
                setSignup(false);
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              className={signup ? "selected" : ""}
              onClick={() => {
                setSignup(true);
                setError("");
              }}
            >
              Create account
            </button>
          </div>
          <form onSubmit={submit} key={signup ? "up" : "in"}>
            <ErrorText>{error}</ErrorText>
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  placeholder="What should we call you?"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  name="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  placeholder={
                    signup ? "At least 10 characters" : "Enter your password"
                  }
                  minLength={signup ? 10 : undefined}
                  maxLength={72}
                  required
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {signup && (
              <p className="field-hint">
                Use a unique password with at least 10 characters.
              </p>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy ? (
                <Spinner />
              ) : (
                <>
                  {signup ? "Create your account" : "Sign in to Penny"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="auth-note">
            <ShieldCheck size={15} /> A private space for your personal
            spending.
          </p>
        </div>
        <span className="auth-copyright">
          Small steps. A little more peace of mind.
        </span>
      </section>
    </main>
  );
}
