// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import AdminPage from "./AdminPage.jsx";

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
    <div style={{ maxWidth: 420, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>IRMA Login</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 10 }}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} autoComplete="email" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Wachtwoord</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} autoComplete="current-password" />
        </div>
        {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}
        <button type="submit">Inloggen</button>
      </form>
    </div>
  );
}

function SelectOrgPage({ session, isAdmin }) {
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
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>Kies vereniging</h2>
      {loading ? (
        <p>Bezig met laden…</p>
      ) : orgs.length === 0 ? (
        <p>Geen verenigingen gekoppeld aan dit account (en geen admin toegang).</p>
      ) : (
        <ul>
          {orgs.map((o) => (
            <li key={o.id} style={{ marginBottom: 8 }}>
              <button onClick={() => pick(o)}>
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

function DashboardPage() {
  const { orgId } = useParams();
  const role = localStorage.getItem("active_org_role") || "referee";
  return (
    <div>
      <h2>Dashboard</h2>
      <div>Org: {orgId}</div>
      <div>Rol: {role}</div>
    </div>
  );
}

function MatchesPage() {
  const { orgId } = useParams();
  return <div>Wedstrijdenlijst (org: {orgId})</div>;
}

function CoordinatorHomePage() {
  const { orgId } = useParams();
  return (
    <div>
      <h2>Coördinator</h2>
      <p>Kies een onderdeel:</p>
      <ul>
        <li><Link to={`/org/${orgId}/coordinator/referees`}>Scheidsrechters beheren</Link></li>
      </ul>
    </div>
  );
}

function CoordinatorRefereesPage() {
  const { orgId } = useParams();
  const activeRole = localStorage.getItem("active_org_role") || "referee";

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
    <div style={{ maxWidth: 900 }}>
      <h2>Scheidsrechters beheren</h2>
      <div style={{ opacity: 0.75, marginBottom: 12 }}>Org: {orgId}</div>

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

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 16 }}>
        <strong>Persoon toevoegen (bestaand account)</strong>
        <form onSubmit={addByEmail} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <input
            placeholder="email@adres.nl"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            style={{ padding: 8, minWidth: 260 }}
          />
          <select value={addRole} onChange={(e) => setAddRole(e.target.value)} style={{ padding: 8 }}>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r === "referee" ? "Scheidsrechter" : r === "coordinator" ? "Coördinator" : "Hoofdcoördinator"}
              </option>
            ))}
          </select>
          <button type="submit">Toevoegen</button>
        </form>
        {addMsg && <div style={{ marginTop: 8, opacity: 0.8 }}>{addMsg}</div>}
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
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
                      onClick={() => removeMember(r.user_id)}
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
      </div>
    </div>
  );
}

/* ---------------------------
   Layout
---------------------------- */

function Layout({ onLogout, isAdmin }) {
  const activeOrgId = localStorage.getItem("active_org_id");
  const activeOrgRole = localStorage.getItem("active_org_role") || "referee";
  const isCoordinator = activeOrgRole === "coordinator" || activeOrgRole === "head_coordinator";

  return (
    <div style={{ fontFamily: "system-ui" }}>
      <header
        style={{
          padding: 12,
          borderBottom: "1px solid #ddd",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <strong>IRMA</strong>

        {isAdmin && <Link to="/admin">Admin</Link>}

        <Link to={activeOrgId ? `/org/${activeOrgId}/dashboard` : "/select-org"}>Dashboard</Link>
        <Link to={activeOrgId ? `/org/${activeOrgId}/matches` : "/select-org"}>Wedstrijden</Link>

        {isCoordinator && activeOrgId && (
          <Link to={`/org/${activeOrgId}/coordinator`}>Coördinator</Link>
        )}

        <span style={{ marginLeft: "auto" }} />
        <button onClick={onLogout}>Uitloggen</button>
      </header>

      <main style={{ padding: 16 }}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireAdmin isAdmin={isAdmin}>
                <AdminPage />
              </RequireAdmin>
            }
          />

          <Route path="/org/:orgId/dashboard" element={<DashboardPage />} />
          <Route path="/org/:orgId/matches" element={<MatchesPage />} />

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
      </main>
    </div>
  );
}

/* ---------------------------
   App root
---------------------------- */

export default function App() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        localStorage.removeItem("active_org_id");
        localStorage.removeItem("active_org_role");
        setIsAdmin(false);
        setAdminChecked(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (!session) return;

      setAdminChecked(false);
      const { data, error } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) console.error(error);

      setIsAdmin(!!data?.user_id);
      setAdminChecked(true);
    })();
  }, [session]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const ready = !!session && adminChecked;

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/select-org" replace /> : <LoginPage />}
      />

      <Route
        path="/select-org"
        element={
          <RequireAuth session={session}>
            {ready ? (
              <SelectOrgPage session={session} isAdmin={isAdmin} />
            ) : (
              <div style={{ padding: 16 }}>Bezig met laden…</div>
            )}
          </RequireAuth>
        }
      />

      <Route
        path="/*"
        element={
          <RequireAuth session={session}>
            {ready ? (
              <Layout onLogout={logout} isAdmin={isAdmin} />
            ) : (
              <div style={{ padding: 16 }}>Bezig met laden…</div>
            )}
          </RequireAuth>
        }
      />
    </Routes>
  );
}
