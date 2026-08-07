"use client";

import { useState, useTransition } from "react";
import type { UserRole } from "@/lib/supabase/types";
import { updateUserRole } from "@/app/(dashboard)/admin/actions";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "מנהל",
  developer: "מפתח הדרכה",
  viewer: "צופה",
};

export function RoleSelector({
  userId,
  initialRole,
  disabled,
}: {
  userId: string;
  initialRole: UserRole;
  disabled?: boolean;
}) {
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: UserRole) {
    const previous = role;
    setRole(next);
    setError(null);
    startTransition(async () => {
      const result = await updateUserRole(userId, next);
      if (result.error) {
        setRole(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={role}
        disabled={disabled || pending}
        onChange={(e) => handleChange(e.target.value as UserRole)}
        className="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800"
      >
        {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
