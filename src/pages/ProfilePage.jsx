import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { passwordValidation } from "../authFlow";

export default function ProfilePage({ session }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const userId = session.user.id;
  useEffect(() => {
    let cancelled = false;
    supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle().then(({ data, error }) => {
      if (!cancelled) { setName(data?.full_name || ""); setError(error?.message || ""); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userId]);
  async function saveProfile(event) {
    event.preventDefault(); setBusy("profile"); setError(""); setNotice("");
    try {
      if (!name.trim()) throw new Error("Vul je naam in.");
      const { error } = await supabase.from("profiles").upsert({ user_id: userId, full_name: name.trim(), email: session.user.email }, { onConflict: "user_id" });
      if (error) throw error;
      setNotice("Je profiel is opgeslagen.");
    } catch (err) { setError(err.message || "Profiel opslaan mislukt."); }
    finally { setBusy(""); }
  }
  async function changePassword(event) {
    event.preventDefault(); setError(""); setNotice("");
    const validation = passwordValidation(newPassword, confirmation);
    if (validation) { setError(validation); return; }
    if (currentPassword === newPassword) { setError("Kies een ander wachtwoord dan je huidige wachtwoord."); return; }
    setBusy("password");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
      if (signInError) throw new Error(signInError.code === "invalid_credentials" ? "Je huidige wachtwoord klopt niet." : signInError.message);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(""); setNewPassword(""); setConfirmation(""); setNotice("Je wachtwoord is gewijzigd.");
    } catch (err) { setError(err.message || "Wachtwoord wijzigen mislukt."); }
    finally { setBusy(""); }
  }
  return <div className="profile-page"><p className="eyebrow">Mijn account</p><h1>Profiel</h1><p className="muted">Beheer je naam en de toegang tot je account.</p>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    {loading ? <p role="status">Profiel laden…</p> : <div className="profile-grid"><section className="panel"><h2>Persoonlijke gegevens</h2><form className="account-form" onSubmit={saveProfile}><fieldset disabled={!!busy}>
      <label htmlFor="profile-name">Naam</label><input id="profile-name" value={name} required maxLength={150} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      <label htmlFor="profile-email">E-mailadres</label><input id="profile-email" type="email" value={session.user.email || ""} readOnly /><p className="field-hint">Dit is het e-mailadres waarmee je inlogt.</p>
      <button>{busy === "profile" ? "Opslaan…" : "Profiel opslaan"}</button>
    </fieldset></form></section><section className="panel"><h2>Wachtwoord wijzigen</h2><form className="account-form" onSubmit={changePassword}><fieldset disabled={!!busy}>
      <label htmlFor="current-password">Huidig wachtwoord</label><input id="current-password" required type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <label htmlFor="new-password">Nieuw wachtwoord</label><input id="new-password" required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><p className="field-hint">Minimaal 8 tekens.</p>
      <label htmlFor="confirm-password">Herhaal nieuw wachtwoord</label><input id="confirm-password" required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      <button>{busy === "password" ? "Wijzigen…" : "Wachtwoord wijzigen"}</button>
    </fieldset></form><Link className="auth-link" to="/forgot-password">Huidig wachtwoord vergeten?</Link></section></div>}
  </div>;
}
