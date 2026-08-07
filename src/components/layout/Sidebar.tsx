"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/supabase/types";

const NAV_ITEMS: { href: string; label: string; minRole?: UserRole }[] = [
  { href: "/icons", label: "אייקוני SVG" },
  { href: "/backgrounds", label: "רקעים" },
  { href: "/outlines", label: "מתווים ומערכי שיעור" },
  { href: "/library", label: "ספריית נכסים" },
  { href: "/admin", label: "ניהול", minRole: "admin" },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => !item.minRole || item.minRole === role);

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-l border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 px-2 text-lg font-semibold">סטודיו הדרכה</div>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
