import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const OrgContext = createContext(null);
export const useOrg = () => useContext(OrgContext);

export function useOrgAccess(orgId, userId) {
  const [state, setState] = useState({ key: null, loading: true, role: null, name: "", error: "" });
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from("memberships")
        .select("role, organizations:org_id(name)").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
      if (!cancelled) setState({ key: `${orgId}:${userId}`, loading: false, role: data?.role || null,
        name: data?.organizations?.name || "", error: error?.message || "" });
    }
    load();
    return () => { cancelled = true; };
  }, [orgId, userId]);
  if (!orgId) return { loading: false, role: null, name: "", error: "" };
  if (state.key !== `${orgId}:${userId}`) return { loading: true, role: null, name: "", error: "" };
  return state;
}
