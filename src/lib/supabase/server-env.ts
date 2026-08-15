import "server-only";

/**
 * Secret env accessor. Separate module (not lib/supabase/env.ts) so the
 * "server-only" import guards it specifically: any client component that
 * transitively imports this file fails the build immediately, instead of
 * the secret silently riding along in a browser bundle.
 */
export function supabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error(
      "Missing environment variable SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill in your Supabase project details."
    );
  }
  return value;
}
