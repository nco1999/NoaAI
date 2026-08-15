import type { BackgroundGenerationParams } from "@/lib/supabase/types";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ASPECT_RATIOS: BackgroundGenerationParams["aspectRatio"][] = ["16:9", "4:3", "1:1", "9:16"];
const TEXT_ZONES: BackgroundGenerationParams["textZone"][] = ["right", "left", "center", "top", "none"];
const STYLES: BackgroundGenerationParams["style"][] = ["minimal", "geometric", "gradient", "tech", "organic"];
const DENSITIES: BackgroundGenerationParams["density"][] = ["minimal", "balanced", "rich"];

export function parseBackgroundGenerationParams(body: unknown): BackgroundGenerationParams {
  if (typeof body !== "object" || body === null) throw new Error("בקשה לא תקינה.");
  const b = body as Record<string, unknown>;

  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (!prompt || prompt.length > 500) {
    throw new Error("יש לתאר את הרקע הרצוי (עד 500 תווים).");
  }

  const aspectRatio = ASPECT_RATIOS.includes(b.aspectRatio as BackgroundGenerationParams["aspectRatio"])
    ? (b.aspectRatio as BackgroundGenerationParams["aspectRatio"])
    : "16:9";

  const textZone = TEXT_ZONES.includes(b.textZone as BackgroundGenerationParams["textZone"])
    ? (b.textZone as BackgroundGenerationParams["textZone"])
    : "none";

  const style = STYLES.includes(b.style as BackgroundGenerationParams["style"])
    ? (b.style as BackgroundGenerationParams["style"])
    : "minimal";

  const density = DENSITIES.includes(b.density as BackgroundGenerationParams["density"])
    ? (b.density as BackgroundGenerationParams["density"])
    : "minimal";

  const color = typeof b.color === "string" && HEX_COLOR.test(b.color) ? b.color : null;

  return { prompt, aspectRatio, textZone, style, density, color };
}
