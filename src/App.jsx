// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, NavLink, useNavigate, useParams, useMatch, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";
import AdminPage from "./AdminPage.jsx";
import LogoutButton from "./components/LogoutButton.jsx";
import { clubTheme } from "./clubTheme";
import MatchesPage from "./pages/MatchesPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/AccountRecovery.jsx";
import { recoveryIntent, setRecoveryIntent } from "./authFlow";
import { OrgContext, useOrg, useOrgAccess } from "./hooks/useOrgAccess";

const roleLabel = (role) => ({ referee: "Scheidsrechter", coordinator: "Coördinator", head_coordinator: "Hoofdcoördinator" }[role] || role);

/* ---------------------------
   Auth helpers
---------------------------- */

function RequireAuth({ session, children }) {
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ isAdmin, children }) {
  if (!isAdmin) return <Navigate to="/select-org" replace />;
  return children;
}

function RequireCoordinatorRole({ role, children }) {
  if (role !== "coordinator" && role !== "head_coordinator") {
    return <Navigate to="/select-org" replace />;
  }
  return children;
}

/* ---------------------------
   Pages
---------------------------- */

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
  };

  return (
    <div className="auth-page"><div className="auth-card">
      <div className="brand-mark">I</div><p className="eyebrow">Integrated Referee Management Assistent</p><h1>Welkom bij IRMA</h1><p className="muted">Log in om naar jouw vereniging te gaan.</p>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 10 }}>
          <label htmlFor="login-email">E-mailadres</label>
          <input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} autoComplete="email" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label htmlFor="login-password">Wachtwoord</label>
          <input id="login-password" required type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} autoComplete="current-password" />
        </div>
        {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}
        <button type="submit">Inloggen</button>
      </form><Link className="auth-link" to="/forgot-password">Wachtwoord vergeten?</Link>
    </div></div>
  );
}

function SelectOrgPage({ session, isAdmin, onLogout }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: membershipsData, error: memErr } = await supabase
        .from("memberships")
        .select("org_id, role, organizations:org_id (id, name)")
        .eq("user_id", session.user.id);

      if (memErr) {
        console.error(memErr);
        setOrgs([]);
        setLoading(false);
        return;
      }

      const list = (membershipsData ?? [])
        .map((row) => ({
          id: row.organizations?.id,
          name: row.organizations?.name,
          role: row.role || "referee",
        }))
        .filter((x) => x.id && x.name);

      if (list.length === 0 && isAdmin) {
        nav("/admin", { replace: true });
        return;
      }

      if (list.length === 1) {
        localStorage.setItem("active_org_id", list[0].id);
        localStorage.setItem("active_org_role", list[0].role);
        nav(`/org/${list[0].id}/dashboard`, { replace: true });
        return;
      }

      setOrgs(list);
      setLoading(false);
    })();
  }, [nav, session.user.id, isAdmin]);

  const pick = (org) => {
    localStorage.setItem("active_org_id", org.id);
    localStorage.setItem("active_org_role", org.role || "referee");
    nav(`/org/${org.id}/dashboard`);
  };

  return (
    <div className="selection-page"><div className="selection-header"><div className="brand-mark">I</div><LogoutButton onLogout={onLogout} /></div><p className="eyebrow">IRMA · Jouw omgeving</p>
      <Link className="text-link selection-profile" to="/profile">Mijn profiel →</Link><h1>Kies je vereniging</h1><p className="muted">Open de vereniging waarvoor je aan de slag wilt.</p>{isAdmin && <Link className="text-link" to="/admin">Naar platformbeheer →</Link>}
      {loading ? (
        <p>Bezig met laden…</p>
      ) : orgs.length === 0 ? (
        <p>Geen verenigingen gekoppeld aan dit account (en geen admin toegang).</p>
      ) : (
        <ul className="org-list">
          {orgs.map((o) => (
            <li key={o.id} style={{ marginBottom: 8 }}>
              <button className="org-option" onClick={() => pick(o)}>
                {o.name}{" "}
                <span style={{ opacity: 0.7 }}>
                  ({o.role === "head_coordinator" ? "hoofdcoördinator" : o.role === "coordinator" ? "coördinator" : "scheidsrechter"})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------
   Org pages (skeleton + referee management)
---------------------------- */

function CoordinatorHomePage() {
  const { orgId } = useParams();
  return <div><p className="eyebrow">Verenigingsbeheer</p><h1>Coördinator</h1><p className="muted">Beheer de personen binnen je vereniging.</p><div className="dashboard-grid"><Link className="module-card" to={`/org/${orgId}/coordinator/referees`}><span className="module-icon" aria-hidden="true">♧</span><h2>Scheidsrechters beheren</h2><p>Voeg bestaande accounts toe en beheer hun rollen.</p><span className="text-link">Open personenbeheer →</span></Link></div></div>;
}

function CoordinatorRefereesPage() {
  const { orgId } = useParams();
  const { role: activeRole } = useOrg();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("referee");
  const [addMsg, setAddMsg] = useState("");

  const roleOptions = ["referee", "coordinator", "head_coordinator"];

  async function load() {
    setLoading(true);
    setErr("");

    // memberships in dit org + join naar profiles
    const { data, error } = await supabase
      .from("memberships")
      .select("user_id, role, profiles (full_name, email)")
      .eq("org_id", orgId)
      .order("role", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function changeRole(userId, newRole) {
    setErr("");

    if (newRole === "head_coordinator") {
      setErr("Hoofdcoördinator instellen kan alleen via admin.");
      return;
    }

    const { data, error } = await supabase.functions.invoke("manage-member", {
      body: {
        action: "change_role",
        orgId,
        userId,
        role: newRole,
      },
    });

    if (error || !data?.ok) {
      setErr(error?.message || data?.error || "Rol wijzigen mislukt.");
      return;
    }

    await load();
  }

  async function removeMember(userId) {
    setErr("");
    if (!confirm("Weet je zeker dat je deze persoon uit de vereniging wilt verwijderen?")) return;

    const { data, error } = await supabase.functions.invoke("manage-member", {
      body: {
        action: "remove",
        orgId,
        userId,
      },
    });

    if (error || !data?.ok) {
      setErr(error?.message || data?.error || "Verwijderen mislukt.");
      return;
    }

    await load();
  }

  async function addByEmail(e) {
    e.preventDefault();
    setErr("");
    setAddMsg("");

    const email = addEmail.trim().toLowerCase();
    if (!email) {
      setAddMsg("Vul een e-mailadres in.");
      return;
    }

    const { data, error } = await supabase.functions.invoke("manage-member", {
      body: {
        action: "add_by_email",
        orgId,
        email,
        role: addRole,
      },
    });

    if (error || !data?.ok) {
      setErr(error?.message || data?.error || "Persoon toevoegen mislukt.");
      return;
    }

    setAddEmail("");
    setAddRole("referee");
    setAddMsg("Toegevoegd.");
    await load();
  }

  const isCoordinator = activeRole === "coordinator" || activeRole === "head_coordinator";

  return (
    <div className="members-page">
      <p className="eyebrow">Coördinatoromgeving</p><h1>Scheidsrechters beheren</h1>
      <p className="muted">Beheer personen en rollen binnen je vereniging.</p>

      {!isCoordinator && (
        <div style={{ padding: 12, background: "#ffe5e5", border: "1px solid #ffb3b3", borderRadius: 8 }}>
          Je hebt geen coördinatorrechten.
        </div>
      )}

      {err && (
        <div style={{ padding: 12, background: "#ffe5e5", border: "1px solid #ffb3b3", borderRadius: 8, marginBottom: 12 }}>
          <strong>Fout:</strong> {err}
        </div>
      )}

      <section className="panel">
        <strong>Persoon toevoegen (bestaand account)</strong>
        <form onSubmit={addByEmail} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <input
            type="email" aria-label="E-mailadres persoon" required placeholder="email@adres.nl"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            style={{ padding: 8, minWidth: 260 }}
          />
          <select aria-label="Rol voor nieuwe persoon" value={addRole} onChange={(e) => setAddRole(e.target.value)} style={{ padding: 8 }}>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r === "referee" ? "Scheidsrechter" : r === "coordinator" ? "Coördinator" : "Hoofdcoördinator"}
              </option>
            ))}
          </select>
          <button type="submit">Toevoegen</button>
        </form>
        {addMsg && <div role="status" style={{ marginTop: 8, opacity: 0.8 }}>{addMsg}</div>}
      </section>

      <section className="panel table-panel">
        <strong>Gekoppelde personen</strong>

        {loading ? (
          <p>Bezig met laden…</p>
        ) : rows.length === 0 ? (
          <p>Geen personen gevonden.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Naam</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Email</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Rol</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {r.profiles?.full_name || "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {r.profiles?.email || "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <select
                      aria-label={`Rol van ${r.profiles?.full_name || r.profiles?.email || "persoon"}`}
                      value={r.role}
                      onChange={(e) => changeRole(r.user_id, e.target.value)}
                      style={{ padding: 6 }}
                      disabled={!isCoordinator || r.role === "head_coordinator"}
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt} value={opt} disabled={opt === "head_coordinator"}>
                          {opt === "referee" ? "Scheidsrechter" : opt === "coordinator" ? "Coördinator" : "Hoofdcoördinator"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button
                      className="danger-button" onClick={() => removeMember(r.user_id)}
                      disabled={!isCoordinator || r.role === "head_coordinator"}
                    >
                      Verwijderen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/* ---------------------------
   Layout
---------------------------- */

function Layout({ onLogout, isAdmin, session }) {
  const orgRoute = useMatch("/org/:orgId/*");
  const activeOrgId = orgRoute?.params.orgId;
  const access = useOrgAccess(activeOrgId, session.user.id);
  const activeOrgRole = access.role;
  if (access.loading) return <div className="selection-page" role="status">Vereniging laden…</div>;
  if (access.error) return <div className="selection-page"><p role="alert">{access.error}</p><Link to="/select-org">Terug naar vereniging kiezen</Link></div>;
  if (activeOrgId && !access.role) return <Navigate to="/select-org" replace />;
  const isCoordinator = activeOrgRole === "coordinator" || activeOrgRole === "head_coordinator";

  return (
    <OrgContext.Provider value={{ ...access, userId: session.user.id }}><div className="app-shell" style={clubTheme(access.name)}>
      <aside className="sidebar">
        <Link to={activeOrgId ? `/org/${activeOrgId}/dashboard` : "/select-org"} className="brand"><span className="brand-mark">I</span><span>IRMA<small>Integrated Referee<br />Management Assistent</small></span></Link>
        <p className="nav-label">WERKOMGEVING</p>
        <nav aria-label="Hoofdnavigatie">
          <NavLink to={activeOrgId ? `/org/${activeOrgId}/dashboard` : "/select-org"}><span aria-hidden="true">▦</span> Dashboard</NavLink>
          <NavLink to={activeOrgId ? `/org/${activeOrgId}/matches` : "/select-org"}><span aria-hidden="true">◷</span> Wedstrijden</NavLink>
          {activeOrgId && <NavLink to={`/org/${activeOrgId}/my-matches`}><span aria-hidden="true">◷</span> Mijn wedstrijden</NavLink>}
          {isCoordinator && activeOrgId && <NavLink to={`/org/${activeOrgId}/coordinator`}><span aria-hidden="true">♧</span> Coördinator</NavLink>}
          <NavLink to={activeOrgId ? `/org/${activeOrgId}/profile` : "/profile"}><span aria-hidden="true">○</span> Profiel</NavLink>
          {isAdmin && <NavLink to="/admin"><span aria-hidden="true">◇</span> Platform Admin</NavLink>}
        </nav>
        <div className="sidebar-footer"><Link to="/select-org">Vereniging kiezen →</Link></div>
      </aside>
      <div className="workspace"><header className="topbar"><span>{access.name || "Integrated Referee Management Assistent"}</span><div className="topbar-actions"><span className="badge">{activeOrgId ? roleLabel(activeOrgRole) : isAdmin ? "Platform Admin" : "Mijn account"}</span><LogoutButton onLogout={onLogout} /></div></header>
      <main className="main-content">
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireAdmin isAdmin={isAdmin}>
                <AdminPage />
              </RequireAdmin>
            }
          />

          <Route path="/profile" element={<ProfilePage session={session} />} />
          <Route path="/org/:orgId/profile" element={<ProfilePage session={session} />} />
          <Route path="/org/:orgId/dashboard" element={<DashboardPage />} />
          <Route path="/org/:orgId/matches" element={<MatchesPage />} />
          <Route path="/org/:orgId/my-matches" element={<MatchesPage personal />} />

          <Route
            path="/org/:orgId/coordinator"
            element={
              <RequireCoordinatorRole role={activeOrgRole}>
                <CoordinatorHomePage />
              </RequireCoordinatorRole>
            }
          />

          <Route
            path="/org/:orgId/coordinator/referees"
            element={
              <RequireCoordinatorRole role={activeOrgRole}>
                <CoordinatorRefereesPage />
              </RequireCoordinatorRole>
            }
          />

          <Route path="*" element={<Navigate to="/select-org" replace />} />
        </Routes>
      </main></div>
    </div></OrgContext.Provider>
  );
}

/* ---------------------------
   App root
---------------------------- */

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [recovery, setRecovery] = useState(recoveryIntent);
  const [adminState, setAdminState] = useState({ userId: null, isAdmin: false, error: "" });
  const location = useLocation();
  const userId = session?.user.id;

  useEffect(() => {
    let cancelled = false;
    // The callback is synchronous: Supabase calls must not be awaited inside it.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return;
      setSession(newSession); setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") { setRecoveryIntent(true); setRecovery(true); }
      if (!newSession && event === "SIGNED_OUT") {
        localStorage.removeItem("active_org_id"); localStorage.removeItem("active_org_role");
        setRecoveryIntent(false); setRecovery(false);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!cancelled) { setSession(data.session); setAuthReady(true); setAuthError(error?.message || ""); }
    }).catch((error) => {
      if (!cancelled) { setAuthReady(true); setAuthError(error.message || "Sessie laden mislukt."); }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setAdminState({ userId, isAdmin: !!data?.user_id, error: error?.message || "" });
      });
    return () => { cancelled = true; };
  }, [userId]);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };
  const completeRecovery = () => { setRecoveryIntent(false); setRecovery(false); };
  const ready = !!session && adminState.userId === userId;
  const isAdmin = ready && adminState.isAdmin;

  if (!authReady) return <div className="selection-page" role="status">Sessie laden…</div>;
  if (authError && !recovery && location.pathname !== "/reset-password" && location.pathname !== "/forgot-password") return <div className="selection-page"><p role="alert">{authError}</p><button onClick={() => window.location.reload()}>Opnieuw proberen</button></div>;
  if (recovery && location.pathname !== "/reset-password" && location.pathname !== "/forgot-password") return <Navigate to="/reset-password" replace />;

  return <Routes>
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage session={session} onComplete={completeRecovery} />} />
    <Route path="/login" element={session ? <Navigate to="/select-org" replace /> : <LoginPage />} />
    <Route path="/select-org" element={<RequireAuth session={session}>{ready ? <SelectOrgPage session={session} isAdmin={isAdmin} onLogout={logout} /> : <div className="selection-page" role="status">Bezig met laden…</div>}</RequireAuth>} />
    <Route path="/*" element={<RequireAuth session={session}>{ready ? adminState.error ? <div className="selection-page"><p role="alert">{adminState.error}</p><button onClick={() => window.location.reload()}>Opnieuw proberen</button></div> : <Layout onLogout={logout} isAdmin={isAdmin} session={session} /> : <div className="selection-page" role="status">Bezig met laden…</div>}</RequireAuth>} />
  </Routes>;
}
