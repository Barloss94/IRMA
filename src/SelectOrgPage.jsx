// src/pages/SelectOrgPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

const LS_KEY = "irma_active_org_id";

export default function SelectOrgPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        if (!cancelled) setError(sessionErr.message);
        if (!cancelled) setLoading(false);
        return;
      }

      const user = sessionData?.session?.user;
      if (!user) {
        // Niet ingelogd -> naar login (pas route aan als jij /login gebruikt)
        navigate("/login", { replace: true });
        return;
      }

      // 1) haal memberships op voor deze user
      const { data: memberships, error: mErr } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id);

      if (mErr) {
        if (!cancelled) setError(mErr.message);
        if (!cancelled) setLoading(false);
        return;
      }

      const orgIds = (memberships || []).map((m) => m.org_id);

      if (orgIds.length === 0) {
        // Geen clubs gekoppeld
        if (!cancelled) {
          setOrgs([]);
          setLoading(false);
        }
        return;
      }

      // 2) haal organisaties op
      const { data: orgRows, error: oErr } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds)
        .order("name", { ascending: true });

      if (oErr) {
        if (!cancelled) setError(oErr.message);
        if (!cancelled) setLoading(false);
        return;
      }

      const list = orgRows || [];

      // 3) AUTO-SELECT als er precies 1 is
      if (list.length === 1) {
        localStorage.setItem(LS_KEY, list[0].id);
        navigate("/dashboard", { replace: true });
        return;
      }

      // 4) 2+ -> laten kiezen
      if (!cancelled) {
        setOrgs(list);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function chooseOrg(orgId) {
    localStorage.setItem(LS_KEY, orgId);
    navigate("/dashboard", { replace: true });
  }

  if (loading) {
    return (
      <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
        <h2>Kies vereniging</h2>
        <p>Bezig met laden…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h2>Kies vereniging</h2>

      {error ? (
        <p style={{ color: "crimson" }}>
          Fout: {error}
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <p>Geen verenigingen gekoppeld aan dit account (en geen admin toegang).</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => chooseOrg(o.id)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                border: "1px solid #ccc",
                borderRadius: 8,
                cursor: "pointer",
                background: "white"
              }}
            >
              <div style={{ fontWeight: 700 }}>{o.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{o.id}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
