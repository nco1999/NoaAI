import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export interface CurrentUser {
  id: string;
  email: string;
  profile: Profile;
}

/** Returns the signed-in user with their profile/role, or null if signed out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { id: user.id, email: user.email ?? profile.email, profile };
}

export function canCreateAssets(role: Profile["role"]): boolean {
  return role === "admin" || role === "developer";
}

export function isAdmin(role: Profile["role"]): boolean {
  return role === "admin";
}
