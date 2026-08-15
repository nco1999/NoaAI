import { NextResponse } from "next/server";
import { getCurrentUser, canCreateAssets } from "@/lib/auth/current-user";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { parseIconGenerationParams } from "@/lib/ai/icon-params";
import { generateIconVariation, refineIconVariation } from "@/lib/ai/icon-generation";

/**
 * Generates (or refines) exactly ONE icon variation per call, mirroring
 * /api/generate/background — the client fires several of these in parallel
 * (one per requested variation, see IconStudio.tsx) instead of asking the
 * server to batch them into a single OpenAI n>1 call, which used to share
 * one 90s timeout across all variations and routinely tripped it.
 *
 * maxDuration is set explicitly (Next.js 16 route segment config) so a
 * hosting platform's default function timeout can't kill the request
 * before our own 90s-per-OpenAI-call timeout (lib/ai/openai.ts) gets a
 * chance to return its own clear error message.
 */
export const maxDuration = 120;

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
    params = parseIconGenerationParams(body);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const b = body as { mode?: string; previousSvg?: string; refinementPrompt?: string };

  try {
    if (b.mode === "refine") {
      if (typeof b.previousSvg !== "string" || !b.previousSvg.includes("<svg")) {
        return NextResponse.json({ error: "חסר SVG קודם לשיפור." }, { status: 400 });
      }
      const refinementPrompt =
        typeof b.refinementPrompt === "string" && b.refinementPrompt.trim()
          ? b.refinementPrompt.trim()
          : params.prompt;
      const variation = await refineIconVariation(params, refinementPrompt);
      return NextResponse.json({ variation });
    }

    const variation = await generateIconVariation(params);
    return NextResponse.json({ variation });
  } catch (error) {
    console.error("Icon generation failed", error);
    return NextResponse.json(
      { error: (error as Error).message || "יצירת האייקון נכשלה." },
      { status: 502 }
    );
  }
}
