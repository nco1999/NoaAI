"use client";

import { useState } from "react";
import type { IconGenerationParams, IconVariation } from "@/lib/supabase/types";
import { IconPromptForm, type IconFormValues } from "./IconPromptForm";
import { VariationCard } from "./VariationCard";

type SlotStatus = "loading" | "done" | "error";

interface VariationSlot {
  slotId: string;
  status: SlotStatus;
  variation?: IconVariation;
  error?: string;
}

async function callGenerateApi(body: Record<string, unknown>): Promise<IconVariation> {
  const res = await fetch("/api/generate/icon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "הבקשה נכשלה.");
  return json.variation as IconVariation;
}

export function IconStudio() {
  const [params, setParams] = useState<IconGenerationParams | null>(null);
  const [slots, setSlots] = useState<VariationSlot[]>([]);

  // Each slot resolves independently — the grid fills in progressively
  // instead of waiting for the slowest variation in the batch (mirrors
  // BackgroundStudio's per-slot fetch pattern).
  async function runSlot(slotId: string, body: Record<string, unknown>) {
    setSlots((prev) => prev.map((s) => (s.slotId === slotId ? { slotId, status: "loading" } : s)));
    try {
      const variation = await callGenerateApi(body);
      setSlots((prev) =>
        prev.map((s) => (s.slotId === slotId ? { slotId, status: "done", variation } : s))
      );
    } catch (err) {
      setSlots((prev) =>
        prev.map((s) =>
          s.slotId === slotId ? { slotId, status: "error", error: (err as Error).message } : s
        )
      );
    }
  }

  function handleGenerate(values: IconFormValues) {
    const { variationCount, ...nextParams } = values;
    setParams(nextParams);

    const newSlots: VariationSlot[] = Array.from({ length: variationCount }, () => ({
      slotId: crypto.randomUUID(),
      status: "loading",
    }));
    setSlots(newSlots);
    newSlots.forEach((slot) => runSlot(slot.slotId, { mode: "generate", ...nextParams }));
  }

  function handleRetry(slotId: string) {
    if (!params) return;
    runSlot(slotId, { mode: "generate", ...params });
  }

  async function handleRefine(currentSvg: string, refinementPrompt: string): Promise<string> {
    if (!params) throw new Error("אין פרמטרים פעילים.");
    const variation = await callGenerateApi({
      mode: "refine",
      ...params,
      previousSvg: currentSvg,
      refinementPrompt,
    });
    return variation.svg;
  }

  const pending = slots.some((s) => s.status === "loading");

  return (
    <div className="space-y-8">
      <IconPromptForm onSubmit={handleGenerate} pending={pending} />

      <div>
        <h2 className="mb-3 text-base font-semibold">תוצאות</h2>

        {slots.length === 0 && (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 dark:border-neutral-700">
            תארי אייקון למעלה כדי להתחיל
          </div>
        )}

        {params && slots.length > 0 && (
          <div className="grid max-w-[950px] grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {slots.map((slot, i) =>
              slot.status === "loading" ? (
                <div
                  key={slot.slotId}
                  className="flex min-h-48 w-full max-w-[320px] items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 dark:border-neutral-700"
                >
                  יוצר אייקון...
                </div>
              ) : slot.status === "error" ? (
                <div
                  key={slot.slotId}
                  className="flex min-h-48 w-full max-w-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-red-300 px-4 text-center text-sm text-red-700 dark:border-red-800 dark:text-red-300"
                >
                  <span>{slot.error ?? "יצירת האייקון נכשלה."}</span>
                  <button
                    onClick={() => handleRetry(slot.slotId)}
                    className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                  >
                    נסי שוב
                  </button>
                </div>
              ) : slot.variation ? (
                <VariationCard
                  key={slot.slotId}
                  index={i}
                  svg={slot.variation.svg}
                  params={params}
                  onRefine={handleRefine}
                />
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}
