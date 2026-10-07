import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { appUrl, passwordValidation, recoveryLinkError } from "../authFlow";

function AuthCard({ title, description, children }) {
  return <div className="auth-page"><div className="auth-card"><div className="brand-mark">I</div><p className="eyebrow">IRMA · Mijn account</p><h1>{title}</h1><p className="muted">{description}</p>{children}</div></div>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl("reset-password") });
      if (error) throw error;
      setSent(true);
    } catch (err) { setError(err.message || "De herstelmail kon niet worden aangevraagd. Probeer het later opnieuw."); }
    finally { setBusy(false); }
  }
  return <AuthCard title="Wachtwoord vergeten" description="Vraag een e-mail aan om een nieuw wachtwoord in te stellen.">
    {error && <div className="alert error" role="alert">{error}</div>}
    {sent ? <div className="alert success" role="status">Als dit e-mailadres bij een account hoort, ontvang je een herstelmail. Controleer ook je spammap.</div> : <form onSubmit={submit}><label htmlFor="recovery-email">E-mailadres</label><input id="recovery-email" type="email" required autoComplete="email" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} /><button disabled={busy}>{busy ? "Aanvragen…" : "Herstelmail aanvragen"}</button></form>}
    <Link className="auth-link" to="/login">Terug naar inloggen</Link>
  </AuthCard>;
}

export function ResetPasswordPage({ session, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const validation = passwordValidation(password, confirmation);
    if (validation) { setError(validation); return; }
    setBusy(true); setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirmation(""); setDone(true); onComplete();
    } catch (err) { setError(err.message || "Wachtwoord wijzigen mislukt. Vraag zo nodig een nieuwe herstelmail aan."); }
    finally { setBusy(false); }
  }
  const valid = !!session && !recoveryLinkError;
  return <AuthCard title={done ? "Wachtwoord ingesteld" : "Nieuw wachtwoord"} description={done ? "Je nieuwe wachtwoord is opgeslagen." : "Kies een nieuw wachtwoord voor je IRMA-account."}>
    {done ? <Link className="button-link" to="/select-org">Verder naar IRMA</Link> : !valid ? <><div className="alert error" role="alert">Deze herstellink is ongeldig of verlopen. Vraag een nieuwe herstelmail aan.</div><Link className="button-link" to="/forgot-password">Nieuwe herstelmail aanvragen</Link></> : <form onSubmit={submit}><fieldset disabled={busy}>
      <label htmlFor="reset-password">Nieuw wachtwoord</label><input id="reset-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label htmlFor="reset-confirmation">Herhaal nieuw wachtwoord</label><input id="reset-confirmation" type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      {error && <div className="alert error" role="alert">{error}</div>}<button>{busy ? "Opslaan…" : "Wachtwoord opslaan"}</button>
    </fieldset></form>}
    <Link className="auth-link" to="/login" onClick={onComplete}>Terug naar inloggen</Link>
  </AuthCard>;
}
