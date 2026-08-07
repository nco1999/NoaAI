import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role client. Bypasses Row Level Security entirely — only use it
 * for server-side operations that have already checked the caller's
 * permissions themselves (e.g. issuing signed storage URLs after verifying
 * asset access).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
