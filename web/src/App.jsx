import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "./api/client.js";
import { Brand } from "./components/ui/Brand.jsx";
import { Spinner } from "./components/ui/Spinner.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { AuthPage } from "./pages/AuthPage.jsx";

export function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");
  const signOut = useCallback(() => setUser(null), []);
  function bootstrap() {
    setBooting(true);
    setBootError("");
    api("/auth/me")
      .then(setUser)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401))
          setBootError(
            "We couldn’t reach Penny. The server may be waking up — please try again.",
          );
      })
      .finally(() => setBooting(false));
  }
  useEffect(bootstrap, []);
  if (booting)
    return (
      <main className="boot">
        <Brand />
        <Spinner />
        <p>Getting your space ready…</p>
      </main>
    );
  if (bootError)
    return (
      <main className="boot">
        <Brand />
        <p>{bootError}</p>
        <button className="button primary" onClick={bootstrap}>
          Try again
        </button>
      </main>
    );
  return user ? (
    <DashboardPage user={user} onSignOut={signOut} />
  ) : (
    <AuthPage onAuth={setUser} />
  );
}
