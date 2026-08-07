"use client";

import { useEffect, useState, useCallback } from "react";
import type { AssetType } from "@/lib/supabase/types";
import { AssetCard, type AssetWithMeta } from "./AssetCard";

export function AssetLibrary() {
  const [type, setType] = useState<AssetType | "all">("all");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<AssetWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (type !== "all") params.set("type", type);
      if (scope === "mine") params.set("scope", "mine");
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/assets?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "טעינת הספרייה נכשלה.");
      setAssets(json.assets);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [type, scope, search]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <input
          type="text"
          placeholder="חיפוש לפי שם..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-40 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AssetType | "all")}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="all">כל הסוגים</option>
          <option value="icon">אייקונים</option>
          <option value="background">רקעים</option>
          <option value="outline">מתווים</option>
        </select>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "all" | "mine")}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="all">הכל</option>
          <option value="mine">שלי בלבד</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && assets.length === 0 && <p className="text-sm text-neutral-400">טוען...</p>}
      {!loading && assets.length === 0 && !error && (
        <p className="text-sm text-neutral-400">לא נמצאו נכסים.</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}
