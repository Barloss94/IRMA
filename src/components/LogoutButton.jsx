import { useState } from "react";

export default function LogoutButton({ onLogout }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await onLogout();
    } catch (err) {
      setError(err.message || "Uitloggen mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="logout-control">
    <button type="button" className="secondary-button topbar-logout" onClick={logout} disabled={busy}>{busy ? "Uitloggen…" : "Uitloggen"}</button>
    {error && <span className="logout-error" role="alert">{error}</span>}
  </div>;
}
