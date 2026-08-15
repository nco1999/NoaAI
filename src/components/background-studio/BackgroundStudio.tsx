"use client";

import { useState } from "react";
import type { BackgroundGenerationParams, BackgroundVariation } from "@/lib/supabase/types";
import { BackgroundPromptForm, type BackgroundFormValues } from "./BackgroundPromptForm";
import { BackgroundResultCard, type BackgroundSlot } from "./BackgroundResultCard";

async function callGenerateBackgroundApi(body: Record<string, unknown>): Promise<BackgroundVariation> {
  const res = await fetch("/api/generate/background", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "יצירת הרקע נכשלה.");
  return json.variation as BackgroundVariation;
}

export function BackgroundStudio() {
  const [params, setParams] = useState<BackgroundGenerationParams | null>(null);
  const [slots, setSlots] = useState<BackgroundSlot[]>([]);

  // Each slot resolves independently — the grid fills in progressively
  // instead of waiting for the slowest image in the batch.
  async function runSlot(slotId: string, body: Record<string, unknown>) {
    setSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { slotId, status: "loading" } : s))
    );
    try {
      const variation = await callGenerateBackgroundApi(body);
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

  function handleGenerate(values: BackgroundFormValues) {
    const { variationCount, ...nextParams } = values;
    setParams(nextParams);

    const newSlots: BackgroundSlot[] = Array.from({ length: variationCount }, () => ({
      slotId: crypto.randomUUID(),
      status: "loading",
    }));
    setSlots(newSlots);
    newSlots.forEach((slot) => runSlot(slot.slotId, { mode: "generate", ...nextParams }));
  }

  function handleAddVariation() {
    if (!params) return;
    const slotId = crypto.randomUUID();
    setSlots((prev) => [...prev, { slotId, status: "loading" }]);
    runSlot(slotId, { mode: "generate", ...params });
  }

  function handleRegenerate(slotId: string) {
    if (!params) return;
    runSlot(slotId, { mode: "generate", ...params });
  }

  function handleRefine(slotId: string, refinementPrompt: string) {
    if (!params) return;
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot?.variation) return;
    runSlot(slotId, {
      mode: "refine",
      ...params,
      previousImage: slot.variation.dataUrl,
      refinementPrompt,
    });
  }

  const pending = slots.some((s) => s.status === "loading");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,360px)_1fr]">
      <BackgroundPromptForm onSubmit={handleGenerate} pending={pending} />

      <div className="min-w-0">
        {slots.length === 0 && (
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 dark:border-neutral-700">
            תארי רקע בטופס משמאל כדי להתחיל
          </div>
        )}

        {params && slots.length > 0 && (
          <>
            <div className="grid max-w-[1600px] grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4">
              {slots.map((slot, i) => (
                <BackgroundResultCard
                  key={slot.slotId}
                  slot={slot}
                  index={i}
                  params={params}
                  onRegenerate={() => handleRegenerate(slot.slotId)}
                  onRefine={(refinementPrompt) => handleRefine(slot.slotId, refinementPrompt)}
                />
              ))}
            </div>

            <button
              onClick={handleAddVariation}
              disabled={pending}
              className="mt-4 rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"
            >
              + עוד וריאציה
            </button>
          </>
        )}
      </div>
    </div>
  );
}
