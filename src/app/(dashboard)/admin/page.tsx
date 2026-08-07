import { getCurrentUser, isAdmin } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { RoleSelector } from "@/components/admin/RoleSelector";
import { formatDate } from "@/lib/format";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.profile.role)) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
        אין לך הרשאה לצפות בעמוד זה.
      </div>
    );
  }

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">ניהול משתמשים</h1>
        <p className="text-sm text-neutral-500">שינוי הרשאות משתמשים בארגון.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-right text-xs text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="px-4 py-2 font-medium">שם</th>
              <th className="px-4 py-2 font-medium">אימייל</th>
              <th className="px-4 py-2 font-medium">הצטרפות</th>
              <th className="px-4 py-2 font-medium">הרשאה</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((profile) => (
              <tr key={profile.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-2">{profile.full_name ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{profile.email}</td>
                <td className="px-4 py-2 text-neutral-500">{formatDate(profile.created_at)}</td>
                <td className="px-4 py-2">
                  <RoleSelector
                    userId={profile.id}
                    initialRole={profile.role}
                    disabled={profile.id === user.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
        ניהול מפתחות API, מכסות שימוש ומעקב עלויות — בשלב הבא של הפיתוח.
      </div>
    </div>
  );
}
