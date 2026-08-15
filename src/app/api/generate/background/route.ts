import { NextResponse } from "next/server";
import { getCurrentUser, canCreateAssets } from "@/lib/auth/current-user";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { parseBackgroundGenerationParams } from "@/lib/ai/background-params";
import { generateBackgroundImage, editBackgroundImage, type GeneratedBackgroundImage } from "@/lib/ai/openai";
import type { BackgroundVariation } from "@/lib/supabase/types";

/**
 * Generates (or refines) exactly ONE background image per call. The client
 * fires several of these in parallel (one per requested variation) instead
 * of asking the server to batch them — that way each card in the UI can
 * update the moment its own request resolves, instead of the whole grid
 * waiting for the slowest image in a batch.
 */

function toVariation(image: GeneratedBackgroundImage): BackgroundVariation {
  return {
    id: crypto.randomUUID(),
    dataUrl: `data:image/png;base64,${image.png.toString("base64")}`,
    width: image.width,
    height: image.height,
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר." }, { status: 401 });
  if (!canCreateAssets(user.profile.role)) {
    return NextResponse.json({ error: "אין הרשאה ליצירת תוצרים." }, { status: 403 });
  }

  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "יותר מדי בקשות. נסה שוב בעוד כמה דקות." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  let params;
  try {
    params = parseBackgroundGenerationParams(body);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const b = body as { mode?: string; previousImage?: string; refinementPrompt?: string };

  try {
    if (b.mode === "refine") {
      const refinementPrompt =
        typeof b.refinementPrompt === "string" ? b.refinementPrompt.trim() : "";
      if (!refinementPrompt) {
        return NextResponse.json({ error: "יש לתאר את השינוי הרצוי." }, { status: 400 });
      }
      const base64 = typeof b.previousImage === "string" ? b.previousImage.split(",").pop() ?? "" : "";
      if (!base64) {
        return NextResponse.json({ error: "חסרה תמונה קודמת לשיפור." }, { status: 400 });
      }

      const previousPng = Buffer.from(base64, "base64");
      const image = await editBackgroundImage(params, previousPng, refinementPrompt);
      return NextResponse.json({ variation: toVariation(image) });
    }

    const image = await generateBackgroundImage(params);
    return NextResponse.json({ variation: toVariation(image) });
  } catch (error) {
    console.error("Background generation failed", error);
    return NextResponse.json(
      { error: (error as Error).message || "יצירת הרקע נכשלה." },
      { status: 502 }
    );
  }
}
