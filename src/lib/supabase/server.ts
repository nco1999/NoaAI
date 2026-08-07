import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. Writing cookies only succeeds from Server Actions/Route
 * Handlers; a plain Server Component render can't set cookies, so a session
 * refresh there is silently dropped. Add a `proxy.ts` (Next.js 16's
 * middleware) running `supabase.auth.getClaims()` if automatic session
 * refresh on every request becomes necessary.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component; ignore since session refresh is
          // handled elsewhere (Server Actions / Route Handlers).
        }
      },
    },
  });
}
