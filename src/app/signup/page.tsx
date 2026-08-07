"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type SignUpState } from "./actions";

const initialState: SignUpState = { status: "idle" };

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          יצירת חשבון
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          משתמש חדש מצטרף כ&rdquo;צופה&rdquo;; מנהל יכול לשדרג הרשאות בהמשך.
        </p>

        {state.status === "success" ? (
          <p className="mt-6 text-sm text-green-700 dark:text-green-400">{state.message}</p>
        ) : (
          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                שם מלא
              </label>
              <input
                type="text"
                name="fullName"
                required
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                אימייל
              </label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                סיסמה
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>

            {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900"
            >
              {pending ? "יוצר חשבון..." : "הרשמה"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-neutral-500">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="font-medium text-neutral-900 underline dark:text-neutral-50">
            התחברות
          </Link>
        </p>
      </div>
    </div>
  );
}
