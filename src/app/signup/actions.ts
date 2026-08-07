"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface SignUpState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function signUp(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) return { status: "error", message: error.message };

  return {
    status: "success",
    message: "נשלח אליך מייל אימות. יש ללחוץ על הקישור כדי להשלים את ההרשמה.",
  };
}
