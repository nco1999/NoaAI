import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const ASSET_BUCKET = "assets";

/**
 * Uploads asset bytes to the (private) `assets` Storage bucket. Path is
 * `${ownerId}/${assetId}/${fileName}` — the storage RLS policies from the
 * initial migration key off the first path segment matching `auth.uid()`,
 * so this must be called with the owning user's own session-bound client
 * (not the service-role client) for those policies to apply correctly.
 */
export async function uploadAssetFile(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  assetId: string,
  fileName: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  const path = `${ownerId}/${assetId}/${fileName}`;
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`אחסון הקובץ נכשל: ${error.message}`);
  }

  return path;
}
