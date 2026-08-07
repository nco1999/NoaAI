import type { Profile } from "@/lib/supabase/types";

const ROLE_LABEL: Record<Profile["role"], string> = {
  admin: "מנהל",
  developer: "מפתח הדרכה",
  viewer: "צופה",
};

export function Header({ profile }: { profile: Profile }) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-sm text-neutral-500">{profile.full_name ?? profile.email}</div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {ROLE_LABEL[profile.role]}
        </span>
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            התנתקות
          </button>
        </form>
      </div>
    </header>
  );
}
