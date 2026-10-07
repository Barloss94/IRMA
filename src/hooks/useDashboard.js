import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export function useDashboard(orgId, userId, coordinator, revision) {
  const [state, setState] = useState({ key: null, loading: true, error: "", counts: {}, next: [] });
  const key = `${orgId}:${userId}:${coordinator}:${revision}`;
  useEffect(() => {
    let cancelled = false;
    const now = new Date().toISOString();
    async function load() {
      try {
        const queries = [
          supabase.from("matches").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("starts_at", now),
          supabase.from("assignments").select("id,matches!assignments_match_id_fkey!inner(starts_at)", { count: "exact", head: true }).eq("org_id", orgId).eq("referee_user_id", userId).gte("matches.starts_at", now),
        ];
        let nextQuery = supabase.from("matches").select(coordinator
          ? "id,home_team,away_team,location,starts_at,assignments!assignments_match_id_fkey(id)"
          : "id,home_team,away_team,location,starts_at,assignments!assignments_match_id_fkey!inner(referee_user_id)")
          .eq("org_id", orgId).gte("starts_at", now).order("starts_at").limit(5);
        if (!coordinator) nextQuery = nextQuery.eq("assignments.referee_user_id", userId);
        queries.push(nextQuery);
        if (coordinator) {
          queries.push(supabase.from("matches").select("id,assignments!assignments_match_id_fkey(id)", { count: "exact", head: true }).eq("org_id", orgId).gte("starts_at", now).is("assignments", null));
          queries.push(supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("org_id", orgId));
        }
        const results = await Promise.all(queries);
        const failed = results.find((result) => result.error);
        if (failed) throw failed.error;
        if (!cancelled) setState({ key, loading: false, error: "", next: results[2].data || [], counts: {
          upcoming: results[0].count ?? 0, own: results[1].count ?? 0,
          unassigned: coordinator ? results[3].count ?? 0 : null, members: coordinator ? results[4].count ?? 0 : null,
        } });
      } catch (error) {
        if (!cancelled) setState({ key, loading: false, error: error.message || "Dashboard laden mislukt.", counts: {}, next: [] });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId, userId, coordinator, key]);
  return state.key === key ? state : { loading: true, error: "", counts: {}, next: [] };
}
