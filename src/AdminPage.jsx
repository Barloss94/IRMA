// src/AdminPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function AdminPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const [newOrgName, setNewOrgName] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);

  const [email, setEmail] = useState("");
  const [busySet, setBusySet] = useState(false);

  const loadOrgs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("id,name,primary_coordinator_user_id,created_at")
      .order("created_at", { ascending: false });

    if (error) console.error("Load orgs error:", error);
    setOrgs(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const createOrg = async () => {
    const name = newOrgName.trim();
    if (!name) return;

    setBusyCreate(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      alert("auth.getUser error:\n" + userErr.message);
      setBusyCreate(false);
      return;
    }

    const { error } = await supabase.from("organizations").insert({
      name,
      primary_coordinator_user_id: userRes.user.id,
    });

    if (error) alert("create org error:\n" + error.message);

    setNewOrgName("");
    await loadOrgs();
    setBusyCreate(false);
  };

  const setHeadCoordinator = async (mode) => {
    const em = email.trim().toLowerCase();
    if (!selectedOrg?.id) return alert("Selecteer eerst een vereniging.");
    if (!em) return alert("Vul een e-mailadres in.");

    setBusySet(true);

    // 1) Pak access token
    const { data: sessRes, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) {
      alert("getSession error:\n" + sessErr.message);
      setBusySet(false);
      return;
    }

    const accessToken = sessRes?.session?.access_token || "";
    const jwtParts = accessToken ? accessToken.split(".").length : 0;
    const tokenLength = accessToken.length;

    if (!accessToken) {
      alert("Geen access token gevonden. Log uit/in.");
      setBusySet(false);
      return;
    }

    // 2) Bouw function URL
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!baseUrl || !anonKey) {
      alert(
        "ENV ontbreekt:\n" +
          JSON.stringify(
            {
              VITE_SUPABASE_URL: !!baseUrl,
              VITE_SUPABASE_ANON_KEY: !!anonKey,
            },
            null,
            2
          )
      );
      setBusySet(false);
      return;
    }

    const url = `${baseUrl}/functions/v1/set-head-coordinator`;

    // 3) Direct fetch (geen supabase.functions.invoke)
    let res;
    let text = "";
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          orgId: selectedOrg.id,
          email: em,
          mode, // "link_only" | "invite"
        }),
      });

      text = await res.text();
    } catch (e) {
      alert("NETWORK ERROR:\n" + String(e));
      setBusySet(false);
      return;
    }

    // 4) Toon altijd status + body (super duidelijk)
    if (!res.ok) {
      alert(
        "EDGE FUNCTION ERROR\n" +
          `Status: ${res.status}\n` +
          `jwtParts: ${jwtParts}\n` +
          `tokenLength: ${tokenLength}\n\n` +
          text
      );
      setBusySet(false);
      return;
    }

    // 5) Parse json
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      alert("OK status maar response is geen JSON:\n\n" + text);
      setBusySet(false);
      return;
    }

    if (!data?.ok) {
      alert("EDGE FUNCTION RESPONSE (ok=false):\n\n" + JSON.stringify(data, null, 2));
      setBusySet(false);
      return;
    }

    alert(`✅ Hoofdcoördinator ingesteld: ${em}`);
    setEmail("");
    await loadOrgs();
    setBusySet(false);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", fontFamily: "system-ui" }}>
      <h2>Admin – Verenigingen</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* LEFT */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <h3>Verenigingen</h3>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Naam vereniging"
              style={{ flex: 1 }}
            />
            <button onClick={createOrg} disabled={busyCreate}>
              {busyCreate ? "Bezig…" : "Aanmaken"}
            </button>
          </div>

          {loading ? (
            <p>Laden…</p>
          ) : orgs.length === 0 ? (
            <p>Nog geen verenigingen.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {orgs.map((o) => (
                <li key={o.id} style={{ marginBottom: 8 }}>
                  <button
                    onClick={() => setSelectedOrg(o)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 10,
                      borderRadius: 8,
                      border: selectedOrg?.id === o.id ? "2px solid #333" : "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{o.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{o.id}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <h3>Beheer</h3>

          {!selectedOrg ? (
            <p>Selecteer links een vereniging.</p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>{selectedOrg.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{selectedOrg.id}</div>
              </div>

              <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
                <h4>Hoofdcoördinator toewijzen</h4>

                <p style={{ opacity: 0.85 }}>
                  <b>A1</b>: account bestaat al → koppelen<br />
                  <b>A2</b>: account bestaat nog niet → uitnodiging sturen (Supabase Auth)
                </p>

                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mailadres hoofdcoördinator"
                  style={{ width: "100%", marginBottom: 10 }}
                  disabled={busySet}
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => setHeadCoordinator("link_only")} disabled={busySet}>
                    {busySet ? "Bezig…" : "A1: Koppel bestaand account"}
                  </button>

                  <button onClick={() => setHeadCoordinator("invite")} disabled={busySet}>
                    {busySet ? "Bezig…" : "A2: Stuur uitnodiging"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
