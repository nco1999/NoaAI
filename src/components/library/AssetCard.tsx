"use client";

import { sanitizeSvg } from "@/lib/svg/sanitize";
import { downloadText } from "@/lib/svg/rasterize";
import { formatDate } from "@/lib/format";
import type { Asset, AssetType } from "@/lib/supabase/types";

const TYPE_LABEL: Record<AssetType, string> = {
  icon: "אייקון",
  background: "רקע",
  outline: "מתווה",
};

export interface AssetWithMeta extends Asset {
  owner: { id: string; full_name: string | null; email: string } | null;
  tags: string[];
}

export function AssetCard({ asset }: { asset: AssetWithMeta }) {
  const svg = asset.type === "icon" ? (asset.content?.svg as string | undefined) : undefined;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex h-28 items-center justify-center rounded-lg bg-neutral-50 [&_svg]:h-14 [&_svg]:w-14 dark:bg-neutral-800">
        {svg ? (
          <div className="text-neutral-800 dark:text-neutral-100" dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }} />
        ) : (
          <span className="text-xs text-neutral-400">{TYPE_LABEL[asset.type]}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>{TYPE_LABEL[asset.type]}</span>
        <span>{asset.visibility === "org" ? "משותף לארגון" : "פרטי"}</span>
      </div>

      <h3 className="truncate text-sm font-medium" title={asset.title}>
        {asset.title}
      </h3>

      {asset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {asset.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-400">
        <span>{asset.owner?.full_name ?? asset.owner?.email ?? ""}</span>
        <span>{formatDate(asset.created_at)}</span>
      </div>

      {svg && (
        <button
          onClick={() => downloadText(svg, `${asset.title}.svg`)}
          className="mt-1 rounded-lg border border-neutral-300 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          הורדת SVG
        </button>
      )}
    </div>
  );
}
