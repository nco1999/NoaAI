import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, canCreateAssets } from "@/lib/auth/current-user";
import type { AssetType, AssetVisibility } from "@/lib/supabase/types";

const ASSET_TYPES: AssetType[] = ["icon", "background", "outline"];
const VISIBILITIES: AssetVisibility[] = ["private", "org"];

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const search = searchParams.get("search")?.trim();
  const scope = searchParams.get("scope"); // "mine" | undefined (RLS already limits to visible rows)
  const limit = Math.min(Number(searchParams.get("limit")) || 40, 100);

  const supabase = await createClient();
  let query = supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type && ASSET_TYPES.includes(type as AssetType)) {
    query = query.eq("type", type as AssetType);
  }
  if (scope === "mine") {
    query = query.eq("owner_id", user.id);
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data: assets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ownerIds = Array.from(new Set((assets ?? []).map((a) => a.owner_id)));
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
    : { data: [] };

  const assetIds = (assets ?? []).map((a) => a.id);
  const { data: assetTagLinks } = assetIds.length
    ? await supabase.from("asset_tags").select("asset_id, tag_id").in("asset_id", assetIds)
    : { data: [] };

  const tagIds = Array.from(new Set((assetTagLinks ?? []).map((l) => l.tag_id)));
  const { data: tagRows } = tagIds.length
    ? await supabase.from("tags").select("id, name").in("id", tagIds)
    : { data: [] };
  const tagNameById = new Map((tagRows ?? []).map((t) => [t.id, t.name]));

  const tagsByAsset = new Map<string, string[]>();
  for (const link of assetTagLinks ?? []) {
    const name = tagNameById.get(link.tag_id);
    if (!name) continue;
    const list = tagsByAsset.get(link.asset_id) ?? [];
    list.push(name);
    tagsByAsset.set(link.asset_id, list);
  }

  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  const enriched = (assets ?? []).map((asset) => ({
    ...asset,
    owner: ownerById.get(asset.owner_id) ?? null,
    tags: tagsByAsset.get(asset.id) ?? [],
  }));

  return NextResponse.json({ assets: enriched });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר." }, { status: 401 });
  if (!canCreateAssets(user.profile.role)) {
    return NextResponse.json({ error: "אין הרשאה ליצירת תוצרים." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const type = body.type;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  const visibility = VISIBILITIES.includes(body.visibility as AssetVisibility)
    ? (body.visibility as AssetVisibility)
    : "private";
  const tags = Array.isArray(body.tags)
    ? Array.from(
        new Set(
          body.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().slice(0, 40))
            .filter(Boolean)
        )
      ).slice(0, 10)
    : [];

  if (!ASSET_TYPES.includes(type as AssetType) || !title) {
    return NextResponse.json({ error: "type ו‑title הם שדות חובה." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      owner_id: user.id,
      type: type as AssetType,
      title,
      description: typeof body.description === "string" ? body.description.slice(0, 2000) : null,
      prompt: typeof body.prompt === "string" ? body.prompt.slice(0, 2000) : null,
      generation_params: (body.generation_params as Record<string, unknown>) ?? {},
      content: (body.content as Record<string, unknown>) ?? {},
      visibility,
    })
    .select("*")
    .single();

  if (error || !asset) {
    return NextResponse.json({ error: error?.message ?? "יצירת הנכס נכשלה." }, { status: 500 });
  }

  if (tags.length > 0) {
    const tagIds: string[] = [];
    for (const name of tags) {
      const { data: existing } = await supabase.from("tags").select("id").eq("name", name).maybeSingle();
      if (existing) {
        tagIds.push(existing.id);
        continue;
      }
      const { data: created, error: tagError } = await supabase
        .from("tags")
        .insert({ name })
        .select("id")
        .single();
      if (!tagError && created) tagIds.push(created.id);
    }

    if (tagIds.length > 0) {
      await supabase.from("asset_tags").insert(tagIds.map((tag_id) => ({ asset_id: asset.id, tag_id })));
    }
  }

  return NextResponse.json({ asset: { ...asset, tags } }, { status: 201 });
}
