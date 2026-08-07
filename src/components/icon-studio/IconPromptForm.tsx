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

  function updateColor(index: number, color: string) {
    setValues((v) => ({
      ...v,
      colors: v.colors.map((c, i) => (i === index ? color : c)),
    }));
  }

  function addColor() {
    if (values.colors.length >= 6) return;
    setValues((v) => ({ ...v, colors: [...v.colors, DEFAULT_COLOR] }));
  }

  function removeColor(index: number) {
    setValues((v) => ({ ...v, colors: v.colors.filter((_, i) => i !== index) }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div>
        <label className="block text-sm font-medium">תיאור האייקון</label>
        <textarea
          required
          maxLength={500}
          rows={3}
          placeholder='לדוגמה: "כובע טקס לתעודת סיום קורס"'
          value={values.prompt}
          onChange={(e) => setValues((v) => ({ ...v, prompt: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="monochrome"
          checked={values.monochrome}
          onChange={(e) => setValues((v) => ({ ...v, monochrome: e.target.checked }))}
        />
        <label htmlFor="monochrome" className="text-sm font-medium">
          מונוכרום (currentColor — ניתן להחלפת צבע בלי לפנות שוב ל‑AI)
        </label>
      </div>

      {!values.monochrome && (
        <div>
          <label className="block text-sm font-medium">צבעים (עד 6)</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {values.colors.map((color, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => updateColor(i, e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-neutral-300 dark:border-neutral-700"
                />
                {values.colors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeColor(i)}
                    className="text-xs text-neutral-400 hover:text-red-600"
                  >
                    הסר
                  </button>
                )}
              </div>
            ))}
            {values.colors.length < 6 && (
              <button
                type="button"
                onClick={addColor}
                className="rounded-lg border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500 hover:border-neutral-500 dark:border-neutral-700"
              >
                + צבע
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
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
          <label className="block text-sm font-medium">עובי קו: {values.strokeWidth}</label>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={values.strokeWidth}
            onChange={(e) => setValues((v) => ({ ...v, strokeWidth: Number(e.target.value) }))}
            className="mt-2 w-full"
            disabled={values.style === "filled"}
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
            className="mt-2 w-full"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || !values.prompt.trim()}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900"
      >
        {pending ? "יוצר אייקונים..." : "צור אייקונים"}
      </button>
    </form>
  );
}
