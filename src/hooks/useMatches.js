import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export function useMatches(orgId, userId, personal = false) {
  const [state, setState] = useState({ key: null, matches: [], loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let query = personal
        ? supabase.from("assignments").select("id, matches!assignments_match_id_fkey!inner(id, org_id, starts_at, location, home_team, away_team, kind)")
          .eq("org_id", orgId).eq("referee_user_id", userId).order("starts_at", { referencedTable: "matches" })
        : supabase.from("matches").select("id, org_id, starts_at, location, home_team, away_team, kind, assignments!assignments_match_id_fkey(id, referee_user_id)")
          .eq("org_id", orgId).order("starts_at");
      const { data, error } = await query;
      if (!cancelled) setState({ key: `${orgId}:${userId}:${personal}`, matches: personal ? (data || []).map((row) => row.matches).filter(Boolean) : data || [], loading: false, error: error?.message || "" });
    }
    load();
    return () => { cancelled = true; };
  }, [orgId, userId, personal, revision]);
  if (state.key !== `${orgId}:${userId}:${personal}`) return { matches: [], loading: true, error: "", reload };
  return { ...state, reload };
}
