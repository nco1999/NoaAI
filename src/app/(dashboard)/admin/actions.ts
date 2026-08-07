"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user";
import type { UserRole } from "@/lib/supabase/types";

export async function updateUserRole(userId: string, role: UserRole): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.profile.role)) {
    return { error: "רק מנהל יכול לשנות הרשאות." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {};
}
