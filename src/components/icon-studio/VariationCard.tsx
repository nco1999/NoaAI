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
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div
        className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg bg-neutral-50 [&_svg]:h-16 [&_svg]:w-16 dark:bg-neutral-800"
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

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={handleDownloadSvg}
          className="rounded-lg border border-neutral-300 py-1.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          הורדת SVG
        </button>
        <button
          onClick={handleCopyCode}
          className="rounded-lg border border-neutral-300 py-1.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          העתקת קוד
        </button>
        {PNG_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => handleDownloadPng(size)}
            className="rounded-lg border border-neutral-300 py-1.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            PNG {size}px
          </button>
        ))}
        <button
          onClick={() => setShowSave((s) => !s)}
          className="rounded-lg bg-neutral-900 py-1.5 font-medium text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900"
        >
          שמירה לספרייה
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="שיפור: לדוגמה 'עגול יותר'"
          value={refinePrompt}
          onChange={(e) => setRefinePrompt(e.target.value)}
          className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
        />
        <button
          onClick={handleRefine}
          disabled={refining || !refinePrompt.trim()}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {refining ? "..." : "שכתוב"}
        </button>
      </div>
      {refineError && <p className="text-xs text-red-600">{refineError}</p>}

      {showSave && (
        <SaveToLibraryForm
          svg={exportSvg}
          params={params}
          onSaved={() => setShowSave(false)}
        />
      )}
    </div>
  );
}
