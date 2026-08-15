"use client";

import { useState } from "react";
import type { IconGenerationParams } from "@/lib/supabase/types";
import { sanitizeSvg } from "@/lib/svg/sanitize";
import { extractColors, replaceColor, bakeCurrentColor, usesCurrentColor } from "@/lib/svg/colorize";
import { rasterizeSvgToPng, downloadBlob, downloadText } from "@/lib/svg/rasterize";
import { SaveToLibraryForm } from "./SaveToLibraryForm";

const PNG_SIZES = [128, 256, 512];

export function VariationCard({
  index,
  svg: initialSvg,
  params,
  onRefine,
}: {
  index: number;
  svg: string;
  params: IconGenerationParams;
  onRefine: (currentSvg: string, refinementPrompt: string) => Promise<string>;
}) {
  const [svg, setSvg] = useState(initialSvg);
  const [previewColor, setPreviewColor] = useState(params.colors[0] ?? "#111827");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);

  const monochrome = usesCurrentColor(svg);
  const literalColors = monochrome ? [] : extractColors(svg);

  const exportSvg = monochrome ? bakeCurrentColor(svg, previewColor) : svg;
  const safePreview = sanitizeSvg(monochrome ? bakeCurrentColor(svg, previewColor) : svg);

  async function handleRefine() {
    if (!refinePrompt.trim()) return;
    setRefining(true);
    setRefineError(null);
    try {
      const updated = await onRefine(svg, refinePrompt.trim());
      setSvg(updated);
      setRefinePrompt("");
    } catch (error) {
      setRefineError((error as Error).message);
    } finally {
      setRefining(false);
    }
  }

  async function handleDownloadPng(size: number) {
    const blob = await rasterizeSvgToPng(exportSvg, size);
    downloadBlob(blob, `icon-${index + 1}-${size}px.png`);
  }

  function handleDownloadSvg() {
    downloadText(exportSvg, `icon-${index + 1}.svg`);
  }

  async function handleCopyCode() {
    await navigator.clipboard.writeText(exportSvg);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div
        className="mx-auto flex h-32 w-32 shrink-0 items-center justify-center rounded-lg bg-neutral-50 [&_svg]:h-16 [&_svg]:w-16 dark:bg-neutral-800"
        style={{ color: previewColor }}
        dangerouslySetInnerHTML={{ __html: safePreview }}
      />

      {monochrome ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-neutral-500">צבע:</span>
          <input
            type="color"
            value={previewColor}
            onChange={(e) => setPreviewColor(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border border-neutral-300 dark:border-neutral-700"
          />
        </div>
      ) : (
        literalColors.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {literalColors.map((color) => (
              <label key={color} className="flex items-center gap-1 text-xs text-neutral-500">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setSvg((current) => replaceColor(current, color, e.target.value))}
                  className="h-6 w-6 cursor-pointer rounded border border-neutral-300 dark:border-neutral-700"
                />
              </label>
            ))}
          </div>
        )
      )}

      <div className="flex min-w-0 flex-col gap-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadSvg}
            className="min-w-0 rounded-lg border border-neutral-300 px-2 py-1.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            הורדת SVG
          </button>
          <button
            onClick={handleCopyCode}
            className="min-w-0 rounded-lg border border-neutral-300 px-2 py-1.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            העתקת קוד
          </button>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-neutral-400">ייצוא PNG</p>
          <div className="grid grid-cols-3 gap-2">
            {PNG_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => handleDownloadPng(size)}
                className="min-w-0 rounded-lg border border-neutral-300 px-1 py-1.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowSave((s) => !s)}
          className="w-full rounded-lg bg-neutral-900 px-2 py-1.5 font-medium text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900"
        >
          שמירה לספרייה
        </button>

        {showSave && (
          <SaveToLibraryForm svg={exportSvg} params={params} onSaved={() => setShowSave(false)} />
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-neutral-400">שיפור</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="לדוגמה: 'עגול יותר'"
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              className="min-w-0 flex-1 basis-32 rounded-lg border border-neutral-300 px-2 py-1.5 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <button
              onClick={handleRefine}
              disabled={refining || !refinePrompt.trim()}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {refining ? "..." : "שכתוב"}
            </button>
          </div>
          {refineError && <p className="mt-1.5 text-red-600">{refineError}</p>}
        </div>
      </div>
    </div>
  );
}
