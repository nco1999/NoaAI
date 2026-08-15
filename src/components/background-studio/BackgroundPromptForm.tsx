"use client";

import { useState } from "react";
import type {
  BackgroundAspectRatio,
  BackgroundDensity,
  BackgroundStyle,
  BackgroundTextZone,
} from "@/lib/supabase/types";

export interface BackgroundFormValues {
  prompt: string;
  aspectRatio: BackgroundAspectRatio;
  textZone: BackgroundTextZone;
  style: BackgroundStyle;
  density: BackgroundDensity;
  color: string | null;
  variationCount: number;
}

export const DEFAULT_BACKGROUND_FORM_VALUES: BackgroundFormValues = {
  prompt: "",
  aspectRatio: "16:9",
  textZone: "none",
  style: "minimal",
  density: "minimal",
  color: null,
  variationCount: 2,
};

const ASPECT_RATIO_LABELS: Record<BackgroundAspectRatio, string> = {
  "16:9": "16:9 — מצגת רחבה (ברירת מחדל)",
  "4:3": "4:3 — מצגת קלאסית",
  "1:1": "1:1 — ריבועי",
  "9:16": "9:16 — אנכי (Stories)",
};

const TEXT_ZONE_LABELS: Record<BackgroundTextZone, string> = {
  none: "ללא העדפה",
  right: "מקום פנוי מימין",
  left: "מקום פנוי משמאל",
  center: "מקום פנוי במרכז",
  top: "מקום פנוי למעלה",
};

const STYLE_LABELS: Record<BackgroundStyle, string> = {
  minimal: "מינימלי ונקי",
  geometric: "גיאומטרי מופשט",
  gradient: "גרדיאנט עדין",
  tech: "טכנולוגי/דיגיטלי",
  organic: "אורגני ורך",
};

const DENSITY_LABELS: Record<BackgroundDensity, string> = {
  minimal: "מינימלי",
  balanced: "מאוזן",
  rich: "עשיר יותר",
};

export function BackgroundPromptForm({
  onSubmit,
  pending,
}: {
  onSubmit: (values: BackgroundFormValues) => void;
  pending: boolean;
}) {
  const [values, setValues] = useState<BackgroundFormValues>(DEFAULT_BACKGROUND_FORM_VALUES);
  const [useCustomColor, setUseCustomColor] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div>
        <label className="block text-sm font-medium">תיאור הרקע</label>
        <textarea
          required
          maxLength={500}
          rows={3}
          placeholder='לדוגמה: "רקע בנושא חדשנות בבנקאות, עם מקום לטקסט בצד ימין"'
          value={values.prompt}
          onChange={(e) => setValues((v) => ({ ...v, prompt: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">יחס גובה-רוחב</label>
        <select
          value={values.aspectRatio}
          onChange={(e) =>
            setValues((v) => ({ ...v, aspectRatio: e.target.value as BackgroundAspectRatio }))
          }
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          {(Object.keys(ASPECT_RATIO_LABELS) as BackgroundAspectRatio[]).map((ratio) => (
            <option key={ratio} value={ratio}>
              {ASPECT_RATIO_LABELS[ratio]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">אזור פנוי לטקסט</label>
        <select
          value={values.textZone}
          onChange={(e) => setValues((v) => ({ ...v, textZone: e.target.value as BackgroundTextZone }))}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          {(Object.keys(TEXT_ZONE_LABELS) as BackgroundTextZone[]).map((zone) => (
            <option key={zone} value={zone}>
              {TEXT_ZONE_LABELS[zone]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">סגנון</label>
          <select
            value={values.style}
            onChange={(e) => setValues((v) => ({ ...v, style: e.target.value as BackgroundStyle }))}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            {(Object.keys(STYLE_LABELS) as BackgroundStyle[]).map((style) => (
              <option key={style} value={style}>
                {STYLE_LABELS[style]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">רמת עומס</label>
          <select
            value={values.density}
            onChange={(e) => setValues((v) => ({ ...v, density: e.target.value as BackgroundDensity }))}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            {(Object.keys(DENSITY_LABELS) as BackgroundDensity[]).map((density) => (
              <option key={density} value={density}>
                {DENSITY_LABELS[density]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="use-custom-color"
            checked={useCustomColor}
            onChange={(e) => {
              setUseCustomColor(e.target.checked);
              setValues((v) => ({ ...v, color: e.target.checked ? (v.color ?? "#2563eb") : null }));
            }}
          />
          <label htmlFor="use-custom-color" className="text-sm font-medium">
            צבע מוביל מותאם אישית (ברירת מחדל: ה-AI בוחר פלטה מתאימה לנושא)
          </label>
        </div>
        {useCustomColor && (
          <input
            type="color"
            value={values.color ?? "#2563eb"}
            onChange={(e) => setValues((v) => ({ ...v, color: e.target.value }))}
            className="mt-2 h-8 w-8 cursor-pointer rounded border border-neutral-300 dark:border-neutral-700"
          />
        )}
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

      <button
        type="submit"
        disabled={pending || !values.prompt.trim()}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900"
      >
        {pending ? "יוצר רקעים..." : "צור רקעים"}
      </button>
    </form>
  );
}
