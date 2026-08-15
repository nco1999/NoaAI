"use client";

import { useState } from "react";
import type { AssetType, AssetVisibility } from "@/lib/supabase/types";

export interface SaveToLibraryPayload {
  content?: Record<string, unknown>;
  imageBase64?: string;
  imageContentType?: string;
}

/**
 * Shared "save to library" form used by both Icon Studio and Background
 * Studio (previously icon-only) — same asset-creation endpoint, same tags/
 * visibility UI, just a different payload shape per asset type.
 */
export function SaveToLibraryForm({
  assetType,
  defaultTitle,
  prompt,
  generationParams,
  payload,
  onSaved,
}: {
  assetType: AssetType;
  defaultTitle: string;
  prompt: string | null;
  generationParams: Record<string, unknown>;
  payload: SaveToLibraryPayload;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle.slice(0, 60));
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<AssetVisibility>("private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: assetType,
          title: title.trim() || "נכס ללא שם",
          prompt,
          generation_params: generationParams,
          visibility,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ...payload,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "השמירה נכשלה.");
      }
      setSaved(true);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return <p className="text-xs text-green-700 dark:text-green-400">נשמר בהצלחה בספרייה.</p>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <input
        type="text"
        placeholder="שם הנכס"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
      />
      <input
        type="text"
        placeholder="תגיות (מופרדות בפסיק)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
      />
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="visibility"
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
          />
          פרטי
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="visibility"
            checked={visibility === "org"}
            onChange={() => setVisibility("org")}
          />
          משותף לארגון
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-neutral-900 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900"
      >
        {saving ? "שומר..." : "שמור"}
      </button>
    </form>
  );
}
