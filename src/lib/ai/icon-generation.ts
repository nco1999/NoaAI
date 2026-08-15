import "server-only";
import type { IconGenerationParams, IconVariation } from "@/lib/supabase/types";
import { generateIconImage } from "@/lib/ai/openai";
import { vectorizeIconImage } from "@/lib/svg/vectorize";
import { validateIconSvg } from "@/lib/svg/validate";

/**
 * Icon pipeline: user prompt -> GPT Image model -> clean monochrome raster
 * -> deterministic vectorization -> SVG validation. No language model ever
 * authors or hand-edits SVG path coordinates — see lib/svg/vectorize.ts for
 * why that step is a classic bitmap tracer instead.
 */

/**
 * Traces one PNG into an SVG and validates it. Throws a distinct, specific
 * Hebrew message per failing stage instead of a generic one, so the client
 * can tell "vectorization failed" apart from "validation failed" apart
 * from an OpenAI-side error/timeout (which throws its own distinct
 * messages — see classifyOpenAIError in lib/ai/openai.ts).
 */
function traceAndValidate(png: Buffer, params: IconGenerationParams): string {
  const vectorizeStart = Date.now();
  let svg: string;
  try {
    svg = vectorizeIconImage(png, params);
  } catch (error) {
    console.error("Icon vectorization failed", error);
    throw new Error("הוקטוריזציה של האייקון (המרה ל-SVG) נכשלה. נסי לנסח את הפרומפט מחדש.");
  }
  console.log(`[icon-gen] vectorization: ${Date.now() - vectorizeStart}ms`);

  const validateStart = Date.now();
  // The vectorizer always outputs currentColor (single tone, or two tones
  // for duotone) regardless of the old multi-literal-color/monochrome
  // toggle — a raster-traced icon is fundamentally a flat-tone silhouette.
  const validation = validateIconSvg(svg, {
    canvasSize: params.canvasSize,
    style: params.style,
    monochrome: true,
  });
  console.log(`[icon-gen] validation: ${Date.now() - validateStart}ms`);

  if (!validation.valid) {
    console.error("Vectorized icon failed validation", [
      ...validation.securityErrors,
      ...validation.qualityErrors,
    ]);
    throw new Error("בדיקת האיכות של האייקון שנוצר נכשלה. נסי לנסח את הפרומפט מחדש או לבחור סגנון אחר.");
  }

  return svg;
}

/**
 * Generates and traces exactly ONE icon variation. The client (see
 * IconStudio.tsx) calls POST /api/generate/icon once per requested
 * variation, in parallel, instead of one call generating every variation —
 * each card can then display the moment its own request resolves, and one
 * slow/failed variation can no longer blow a timeout shared with the rest.
 */
export async function generateIconVariation(params: IconGenerationParams): Promise<IconVariation> {
  const totalStart = Date.now();
  const image = await generateIconImage(params);
  const svg = traceAndValidate(image.png, params);
  console.log(`[icon-gen] total request: ${Date.now() - totalStart}ms`);
  return { id: crypto.randomUUID(), svg };
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
  return generateIconVariation({ ...params, prompt: `${params.prompt}, ${refinementPrompt}` });
}
