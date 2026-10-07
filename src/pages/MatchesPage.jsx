import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useOrg } from "../hooks/useOrgAccess";
import { useMatches } from "../hooks/useMatches";

const emptyForm = { home_team: "", away_team: "", date: "", time: "", location: "" };
import { dateParts, formatMatchDate, dutchDateTime } from "../matchDates";

export default function MatchesPage({ personal = false }) {
  const { orgId } = useParams();
  const { userId, role } = useOrg();
  const canManage = !personal && ["coordinator", "head_coordinator"].includes(role);
  const { matches, loading, error, reload } = useMatches(orgId, userId, personal);
  const [members, setMembers] = useState([]);
  const [memberError, setMemberError] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("upcoming");
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [assignmentMatch, setAssignmentMatch] = useState(null);
  const [refereeId, setRefereeId] = useState("");

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    supabase.from("memberships").select("user_id, role, profiles(full_name, email)").eq("org_id", orgId)
      .then(({ data, error }) => {
        if (!cancelled) { setMembers(data || []); setMemberError(error?.message || ""); }
      });
    return () => { cancelled = true; };
  }, [orgId, canManage]);

  function openEditor(match) {
    setMutationError(""); setNotice(""); setAssignmentMatch(null);
    setEditor(match || { id: null });
    if (!match) { setForm(emptyForm); return; }
    const parts = Object.fromEntries(dateParts.formatToParts(new Date(match.starts_at)).map((p) => [p.type, p.value]));
    setForm({ home_team: match.home_team || "", away_team: match.away_team || "", location: match.location || "", date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` });
  }

  async function mutate(action, success) {
    setBusy(true); setMutationError(""); setNotice("");
    try {
      await action(); setNotice(success); reload(); return true;
    } catch (err) { setMutationError(err.message || "Opslaan mislukt."); return false; }
    finally { setBusy(false); }
  }

  async function saveMatch(event) {
    event.preventDefault();
    const ok = await mutate(async () => {
      if (!form.home_team.trim() || !form.away_team.trim()) throw new Error("Vul beide teams in.");
      const payload = { home_team: form.home_team.trim(), away_team: form.away_team.trim(), location: form.location.trim() || null, starts_at: dutchDateTime(form.date, form.time) };
      const query = editor.id
        ? supabase.from("matches").update(payload).eq("org_id", orgId).eq("id", editor.id)
        : supabase.from("matches").insert({ ...payload, org_id: orgId, kind: "regular", created_by: userId });
      const { data, error } = await query.select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Geen wedstrijd opgeslagen. Controleer je rechten.");
    }, editor.id ? "Wedstrijd bijgewerkt." : "Wedstrijd toegevoegd.");
    if (ok) setEditor(null);
  }

  async function removeMatch(match) {
    if (!window.confirm(`Wedstrijd ${match.home_team} – ${match.away_team} verwijderen? De aanstellingen worden ook verwijderd.`)) return;
    await mutate(async () => {
      const { data, error } = await supabase.from("matches").delete().eq("org_id", orgId).eq("id", match.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Verwijderen niet toegestaan.");
      if (assignmentMatch === match.id) setAssignmentMatch(null);
      if (editor?.id === match.id) setEditor(null);
    }, "Wedstrijd verwijderd.");
  }

  async function addAssignment(event) {
    event.preventDefault();
    const ok = await mutate(async () => {
      const { error } = await supabase.from("assignments").insert({ org_id: orgId, match_id: assignmentMatch, referee_user_id: refereeId, assigned_by: userId });
      if (error) throw new Error(error.code === "23505" ? "Deze persoon is al aangesteld voor deze wedstrijd." : error.message);
    }, "Scheidsrechter aangesteld.");
    if (ok) setRefereeId("");
  }

  async function removeAssignment(assignment) {
    if (!window.confirm("Deze aanstelling verwijderen?")) return;
    await mutate(async () => {
      const { data, error } = await supabase.from("assignments").delete().eq("org_id", orgId).eq("id", assignment.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Verwijderen niet toegestaan.");
    }, "Aanstelling verwijderd.");
  }

  const now = Date.now();
  const filtered = matches.filter((match) => {
    const future = new Date(match.starts_at).getTime() >= now;
    return (period === "all" || (period === "upcoming" ? future : !future)) &&
      `${match.home_team || ""} ${match.away_team || ""} ${match.location || ""}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => period === "past" ? new Date(b.starts_at) - new Date(a.starts_at) : new Date(a.starts_at) - new Date(b.starts_at));
  const nameFor = (id) => { const member = members.find((m) => m.user_id === id); return member?.profiles?.full_name || member?.profiles?.email || "Gekoppelde persoon"; };
  const selectedMatch = matches.find((m) => m.id === assignmentMatch);
  const candidates = members.filter((m) => !selectedMatch?.assignments?.some((a) => a.referee_user_id === m.user_id));

  return <div>
    <p className="eyebrow">{personal ? "Scheidsrechteromgeving" : "Jouw vereniging"}</p>
    <div className="page-heading"><div><h1>{personal ? "Mijn wedstrijden" : "Wedstrijden"}</h1><p className="muted">{personal ? "Wedstrijden waarvoor jij bent aangesteld." : "Het wedstrijdprogramma van je vereniging."}</p></div>{canManage && <button disabled={busy} onClick={() => openEditor(null)}>+ Wedstrijd toevoegen</button>}</div>
    {(error || mutationError || memberError) && <div className="alert error" role="alert">{mutationError || error || memberError}</div>}
    {notice && <div className="alert success" role="status">{notice}</div>}
    {editor && canManage && <section className="panel"><h2>{editor.id ? "Wedstrijd wijzigen" : "Nieuwe wedstrijd"}</h2><form onSubmit={saveMatch} className="match-form"><fieldset disabled={busy}><div className="form-grid">
      <label>Thuisteam<input required maxLength={150} value={form.home_team} onChange={(e) => setForm({ ...form, home_team: e.target.value })} /></label>
      <label>Uitteam<input required maxLength={150} value={form.away_team} onChange={(e) => setForm({ ...form, away_team: e.target.value })} /></label>
      <label>Datum<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
      <label>Tijd (Nederland)<input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
      <label className="full-width">Locatie / veld<input maxLength={250} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Bijvoorbeeld Sportpark, veld 1" /></label>
    </div><div className="button-row"><button type="submit">{busy ? "Opslaan…" : "Opslaan"}</button><button type="button" className="secondary-button" onClick={() => setEditor(null)}>Annuleren</button></div></fieldset></form></section>}
    <div className="filters"><input aria-label="Zoek wedstrijden" placeholder="Zoek team of locatie…" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Periode" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="upcoming">Komende wedstrijden</option><option value="past">Afgelopen wedstrijden</option><option value="all">Alle wedstrijden</option></select><button className="secondary-button" disabled={busy} onClick={reload}>Vernieuwen</button></div>
    {loading ? <p role="status">Wedstrijden laden…</p> : !filtered.length ? <section className="empty-state"><h2>Geen wedstrijden gevonden</h2><p>{personal ? "Je hebt geen aanstellingen binnen deze selectie." : "Pas je filters aan of voeg als coördinator een wedstrijd toe."}</p></section> : <div className="match-list">{filtered.map((match) => <article className="panel match-card" key={match.id}>
      <div className="page-heading"><div><span className="badge">{formatMatchDate(match.starts_at)}</span><h2>{match.home_team || "Thuisteam"} – {match.away_team || "Uitteam"}</h2><p className="muted">{match.location || "Locatie nog niet ingevuld"}</p></div>{canManage && <div className="button-row"><button className="secondary-button" disabled={busy} onClick={() => openEditor(match)}>Wijzigen</button><button className="danger-button" disabled={busy} onClick={() => removeMatch(match)}>Verwijderen</button></div>}</div>
      {canManage && <div className="assignment-section"><h3>Scheidsrechters</h3>{match.assignments?.length ? <ul className="assignment-list">{match.assignments.map((assignment) => <li key={assignment.id}><span>{nameFor(assignment.referee_user_id)}</span><button className="danger-button" disabled={busy} onClick={() => removeAssignment(assignment)}>Aanstelling verwijderen</button></li>)}</ul> : <p className="muted">Nog geen scheidsrechter aangesteld.</p>}
      {assignmentMatch === match.id ? <form className="button-row" onSubmit={addAssignment}><select aria-label="Scheidsrechter kiezen" required disabled={busy} value={refereeId} onChange={(e) => setRefereeId(e.target.value)}><option value="">Kies een persoon…</option>{candidates.map((member) => <option key={member.user_id} value={member.user_id}>{nameFor(member.user_id)}</option>)}</select><button disabled={busy || !refereeId}>Aanstellen</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setAssignmentMatch(null)}>Sluiten</button>{!candidates.length && <span className="muted">Geen andere gekoppelde personen beschikbaar.</span>}</form> : <button className="secondary-button" disabled={busy || !!memberError} onClick={() => { setEditor(null); setAssignmentMatch(match.id); setRefereeId(""); }}>Scheidsrechter aanstellen</button>}</div>}
    </article>)}</div>}
  </div>;
}
