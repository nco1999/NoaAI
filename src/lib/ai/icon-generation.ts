import "server-only";
import type { IconGenerationParams, IconVariation } from "@/lib/supabase/types";
import { generateIconImages } from "@/lib/ai/openai";
import { vectorizeIconImage } from "@/lib/svg/vectorize";
import { validateIconSvg } from "@/lib/svg/validate";

/**
 * Icon pipeline: user prompt -> GPT Image model -> clean monochrome raster
 * -> deterministic vectorization -> SVG validation. No language model ever
 * authors or hand-edits SVG path coordinates — see lib/svg/vectorize.ts for
 * why that step is a classic bitmap tracer instead.
 */

async function traceAndValidate(
  png: Buffer,
  params: IconGenerationParams
): Promise<IconVariation | null> {
  let svg: string;
  try {
    svg = vectorizeIconImage(png, params);
  } catch (error) {
    console.error("Icon vectorization failed", error);
    return null;
  }

  // The vectorizer always outputs currentColor (single tone, or two tones
  // for duotone) regardless of the old multi-literal-color/monochrome
  // toggle — a raster-traced icon is fundamentally a flat-tone silhouette.
  const validation = validateIconSvg(svg, {
    canvasSize: params.canvasSize,
    style: params.style,
    monochrome: true,
  });

  if (!validation.valid) {
    console.error("Vectorized icon failed validation", [
      ...validation.securityErrors,
      ...validation.qualityErrors,
    ]);
    return null;
  }

  return { id: crypto.randomUUID(), svg };
}

export async function generateIconVariations(params: IconGenerationParams): Promise<IconVariation[]> {
  const images = await generateIconImages(params);
  const results = await Promise.all(images.map((image) => traceAndValidate(image.png, params)));
  const variations = results.filter((v): v is IconVariation => v !== null);

  if (variations.length === 0) {
    throw new Error("יצירת האייקונים נכשלה בשלב הוקטוריזציה/הבדיקה. נסי לנסח את הפרומפט מחדש.");
  }
  return variations;
}

/**
 * "Refine" regenerates from the image model with the refinement folded into
 * the prompt, instead of asking a language model to hand-edit the traced
 * SVG's coordinates — that hand-editing is exactly the failure mode this
 * pipeline replaces, so it isn't an option here even for small tweaks.
 */
export async function refineIconVariation(
  params: IconGenerationParams,
  refinementPrompt: string
): Promise<IconVariation> {
  const refinedParams: IconGenerationParams = {
    ...params,
    prompt: `${params.prompt}, ${refinementPrompt}`,
    variationCount: 1,
  };

  const [image] = await generateIconImages(refinedParams);
  const variation = await traceAndValidate(image.png, refinedParams);

  if (!variation) {
    throw new Error("השיפור נכשל בשלב הוקטוריזציה/הבדיקה. נסי ניסוח אחר.");
  }
  return variation;
}
