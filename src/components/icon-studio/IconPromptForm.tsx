"use client";

import { useState } from "react";
import type { IconGenerationParams } from "@/lib/supabase/types";

const DEFAULT_COLOR = "#111827";

export interface IconFormValues {
  prompt: string;
  colors: string[];
  monochrome: boolean;
  style: IconGenerationParams["style"];
  strokeWidth: number;
  canvasSize: IconGenerationParams["canvasSize"];
  variationCount: number;
}

export const DEFAULT_FORM_VALUES: IconFormValues = {
  prompt: "",
  colors: [DEFAULT_COLOR],
  monochrome: true,
  style: "outline",
  strokeWidth: 2,
  canvasSize: 48,
  variationCount: 4,
};

export function IconPromptForm({
  onSubmit,
  pending,
}: {
  onSubmit: (values: IconFormValues) => void;
  pending: boolean;
}) {
  const [values, setValues] = useState<IconFormValues>(DEFAULT_FORM_VALUES);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-medium">תיאור האייקון</label>
          <textarea
            required
            maxLength={500}
            rows={2}
            placeholder='לדוגמה: "כובע טקס לתעודת סיום קורס"'
            value={values.prompt}
            onChange={(e) => setValues((v) => ({ ...v, prompt: e.target.value }))}
            className="mt-1 w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>

        <button
          type="submit"
          disabled={pending || !values.prompt.trim()}
          className="w-full shrink-0 rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 md:w-auto dark:bg-neutral-50 dark:text-neutral-900"
        >
          {pending ? "יוצר אייקונים..." : "צור אייקונים"}
        </button>
      </div>

      <p className="text-xs text-neutral-400">
        הצבע נקבע אחרי היצירה, ישירות על כל וריאציה (בלי לפנות שוב ל‑AI) — אין צורך לבחור אותו כאן.
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <label className="block text-sm font-medium">סגנון</label>
          <select
            value={values.style}
            onChange={(e) =>
              setValues((v) => ({ ...v, style: e.target.value as IconFormValues["style"] }))
            }
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="outline">קווי (outline)</option>
            <option value="filled">מלא (filled)</option>
            <option value="duotone">דו‑גוני (duotone)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">גודל Canvas</label>
          <select
            value={values.canvasSize}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                canvasSize: Number(e.target.value) as IconFormValues["canvasSize"],
              }))
            }
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value={24}>24px</option>
            <option value={48}>48px</option>
            <option value={64}>64px</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">עובי קו (קווי): {values.strokeWidth}</label>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={values.strokeWidth}
            onChange={(e) => setValues((v) => ({ ...v, strokeWidth: Number(e.target.value) }))}
            className="mt-3 w-full"
            disabled={values.style !== "outline"}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">מספר וריאציות: {values.variationCount}</label>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={values.variationCount}
            onChange={(e) => setValues((v) => ({ ...v, variationCount: Number(e.target.value) }))}
            className="mt-3 w-full"
          />
        </div>
      </div>
    </form>
  );
}
