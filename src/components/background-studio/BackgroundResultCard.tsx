"use client";

import { useState } from "react";
import type { BackgroundGenerationParams, BackgroundVariation } from "@/lib/supabase/types";
import { ASPECT_RATIO_CSS } from "@/lib/background-aspect";
import { downloadDataUrl } from "@/lib/download";
import { SaveToLibraryForm } from "@/components/library/SaveToLibraryForm";

export type BackgroundSlotStatus = "loading" | "done" | "error";

export interface BackgroundSlot {
  slotId: string;
  status: BackgroundSlotStatus;
  variation?: BackgroundVariation;
  error?: string;
}

export function BackgroundResultCard({
  slot,
  index,
  params,
  onRegenerate,
  onRefine,
}: {
  slot: BackgroundSlot;
  index: number;
  params: BackgroundGenerationParams;
  onRegenerate: () => void;
  onRefine: (refinementPrompt: string) => void;
}) {
  const [showSave, setShowSave] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  const aspectRatioCss = ASPECT_RATIO_CSS[params.aspectRatio];

  function handleDownload() {
    if (!slot.variation) return;
    downloadDataUrl(slot.variation.dataUrl, `background-${index + 1}.png`);
  }

  function handleRefineSubmit() {
    if (!refinePrompt.trim()) return;
    onRefine(refinePrompt.trim());
    setRefinePrompt("");
  }

  return (
    <div className="flex w-full min-w-0 max-w-[560px] flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div
        className="flex w-full items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800"
        style={{ aspectRatio: aspectRatioCss }}
      >
        {slot.status === "loading" && (
          <div className="flex flex-col items-center gap-2 text-xs text-neutral-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
            <span>יוצר רקע...</span>
          </div>
        )}
        {slot.status === "error" && (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-red-600">
            <span>{slot.error ?? "יצירת הרקע נכשלה."}</span>
            <button
              onClick={onRegenerate}
              className="rounded-lg border border-red-300 px-3 py-1 font-medium hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              נסי שוב
            </button>
          </div>
        )}
        {slot.status === "done" && slot.variation && (
          // eslint-disable-next-line @next/next/no-img-element -- in-memory base64 data: URI, not a static/remote asset next/image can optimize
          <img src={slot.variation.dataUrl} alt="" className="h-full w-full object-contain" />
        )}
      </div>

      {slot.status === "done" && slot.variation && (
        <div className="flex min-w-0 flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownload}
              className="min-w-0 rounded-lg border border-neutral-300 px-2 py-1.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              הורדת תמונה
            </button>
            <button
              onClick={onRegenerate}
              className="min-w-0 rounded-lg border border-neutral-300 px-2 py-1.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              יצירה מחדש
            </button>
          </div>

          <button
            onClick={() => setShowSave((s) => !s)}
            className="w-full rounded-lg bg-neutral-900 px-2 py-1.5 font-medium text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900"
          >
            שמירה לספרייה
          </button>

          {showSave && (
            <SaveToLibraryForm
              assetType="background"
              defaultTitle={params.prompt}
              prompt={params.prompt}
              generationParams={params}
              payload={{ imageBase64: slot.variation.dataUrl, imageContentType: "image/png" }}
              onSaved={() => setShowSave(false)}
            />
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-neutral-400">שיפור</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="לדוגמה: 'פחות אלמנטים', 'יותר כתום'"
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
                className="min-w-0 flex-1 basis-32 rounded-lg border border-neutral-300 px-2 py-1.5 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                onClick={handleRefineSubmit}
                disabled={!refinePrompt.trim()}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                שכתוב
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
