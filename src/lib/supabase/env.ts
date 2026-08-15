/**
 * Client-safe env accessors: NEXT_PUBLIC_* vars only. Deliberately no
 * "server-only" import — this module is bundled into the browser (via
 * lib/supabase/client.ts), so it must never reference a secret.
 *
 * Access is via static `process.env.NEXT_PUBLIC_X` member expressions, not
 * `process.env[name]`. Next.js inlines NEXT_PUBLIC_* values into the client
 * bundle at build time by statically matching that literal expression; a
 * dynamic/bracket lookup isn't recognized, so the browser bundle would see
 * `undefined` even with a correctly-set .env.local (server-side code would
 * still work, since Node has the real process.env there — the failure is
 * client-only, which is exactly what happened here).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill in your Supabase project details.`
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
