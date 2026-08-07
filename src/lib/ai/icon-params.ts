import type { IconGenerationParams } from "@/lib/supabase/types";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const STYLES: IconGenerationParams["style"][] = ["outline", "filled", "duotone"];
const CANVAS_SIZES: IconGenerationParams["canvasSize"][] = [24, 48, 64];

export function parseIconGenerationParams(body: unknown): IconGenerationParams {
  if (typeof body !== "object" || body === null) throw new Error("Invalid request body.");
  const b = body as Record<string, unknown>;

  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (!prompt || prompt.length > 500) {
    throw new Error("Prompt is required and must be under 500 characters.");
  }

  const monochrome = Boolean(b.monochrome);

  const rawColors = Array.isArray(b.colors) ? b.colors : [];
  const colors = rawColors.filter((c): c is string => typeof c === "string" && HEX_COLOR.test(c));
  if (!monochrome && colors.length === 0) {
    throw new Error("Provide at least one color, or enable monochrome.");
  }
  if (colors.length > 6) throw new Error("Use at most 6 colors.");

  const style = STYLES.includes(b.style as IconGenerationParams["style"])
    ? (b.style as IconGenerationParams["style"])
    : "outline";

  const strokeWidth = Number(b.strokeWidth);
  const safeStrokeWidth = Number.isFinite(strokeWidth) ? Math.min(Math.max(strokeWidth, 0.5), 8) : 2;

  const canvasSize = CANVAS_SIZES.includes(b.canvasSize as IconGenerationParams["canvasSize"])
    ? (b.canvasSize as IconGenerationParams["canvasSize"])
    : 48;

  const variationCount = Number(b.variationCount);
  const safeVariationCount = Number.isInteger(variationCount)
    ? Math.min(Math.max(variationCount, 1), 4)
    : 4;

  return {
    prompt,
    colors,
    monochrome,
    style,
    strokeWidth: safeStrokeWidth,
    canvasSize,
    variationCount: safeVariationCount,
  };
}
