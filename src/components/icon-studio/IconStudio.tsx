"use client";

import { useState } from "react";
import type { IconGenerationParams, IconVariation } from "@/lib/supabase/types";
import { IconPromptForm, type IconFormValues } from "./IconPromptForm";
import { VariationCard } from "./VariationCard";

async function callGenerateApi(body: Record<string, unknown>): Promise<IconVariation[]> {
  const res = await fetch("/api/generate/icon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "הבקשה נכשלה.");
  return json.variations;
}

export function IconStudio() {
  const [params, setParams] = useState<IconGenerationParams | null>(null);
  const [variations, setVariations] = useState<IconVariation[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(values: IconFormValues) {
    setPending(true);
    setError(null);
    try {
      const nextParams: IconGenerationParams = { ...values };
      const result = await callGenerateApi(nextParams);
      setParams(nextParams);
      setVariations(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function handleRefine(currentSvg: string, refinementPrompt: string): Promise<string> {
    if (!params) throw new Error("אין פרמטרים פעילים.");
    const [variation] = await callGenerateApi({
      mode: "refine",
      ...params,
      previousSvg: currentSvg,
      refinementPrompt,
    });
    return variation.svg;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      <IconPromptForm onSubmit={handleGenerate} pending={pending} />

      <div>
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {variations.length === 0 && !pending && !error && (
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 dark:border-neutral-700">
            תארי אייקון בטופס משמאל כדי להתחיל
          </div>
        )}

        {pending && variations.length === 0 && (
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 dark:border-neutral-700">
            יוצר וריאציות...
          </div>
        )}

        {params && variations.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {variations.map((variation, i) => (
              <VariationCard
                key={variation.id}
                index={i}
                svg={variation.svg}
                params={params}
                onRefine={handleRefine}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
