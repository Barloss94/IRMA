import { createClient } from "@supabase/supabase-js";
import { recoveryIntent, setRecoveryIntent } from "./authFlow";

// Preserve recovery intent before Supabase consumes and clears the URL fragment.
if (recoveryIntent()) setRecoveryIntent(true);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase configuratie ontbreekt. Controleer VITE_SUPABASE_URL en VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
