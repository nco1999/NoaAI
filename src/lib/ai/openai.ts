import "server-only";
import type { IconGenerationParams } from "@/lib/supabase/types";

// GPT Image 2 is OpenAI's current image generation model as of writing.
// Configurable via env so it can be bumped without a code change when a
// newer GPT Image model ships.
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

// Square source resolution requested from the model. High enough that the
// vectorizer (see lib/svg/vectorize.ts) has clean edges to trace; the result
// is rescaled to the icon's own viewBox afterwards, so this number doesn't
// need to match canvasSize.
const SOURCE_SIZE = 1024;

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY. Set it in .env.local (see .env.example).");
  }
  return key;
}

function strokeWeightLabel(strokeWidth: number): string {
  if (strokeWidth <= 1.5) return "very thin, delicate";
  if (strokeWidth <= 3) return "medium-weight";
  return "bold, thick";
}

function styleDescription(style: IconGenerationParams["style"], strokeWidth: number): string {
  switch (style) {
    case "outline":
      return `pure line-art / outline icon style: only ${strokeWeightLabel(strokeWidth)} black outlines of perfectly uniform width, shapes are hollow/unfilled inside, like a linear icon-font glyph`;
    case "filled":
      return "solid filled silhouette icon style: flat solid black filled shapes only, no outlines, like a filled/glyph icon-font symbol";
    case "duotone":
      return "two-tone icon style: a solid pure black shape for the single most important part of the subject, plus a solid medium 50% gray shape for the rest/background part of the subject — exactly those two flat tones on white, no blending or gradient between them";
  }
}

// This is deliberately a strict checklist, not a loose creative brief: every
// bullet maps directly to something the vectorizer needs to be true (flat
// tones for clean color quantization, a plain background for artifact-free
// tracing, simple forms for a low path count) or that the user explicitly
// asked for.
function buildImagePrompt(params: IconGenerationParams): string {
  return [
    `Professional minimal icon of: ${params.prompt}.`,
    "Single subject, single concept only — nothing else in the frame.",
    "Centered composition, with a generous even margin of empty space around the subject.",
    `${styleDescription(params.style, params.strokeWidth)}.`,
    "Flat, solid, pure white background. No scene, no ground plane, no props beyond the subject itself.",
    "No text, letters, numbers, or watermarks anywhere in the image.",
    "No drop shadows, no soft shadows, no gradients, no glow or lighting effects, no 3D shading or depth, no photorealism, no surface texture.",
    "Simple clean geometric forms, smooth confident lines, consistent visual weight throughout the whole icon.",
    "Must stay clearly readable and instantly recognizable when shrunk down to 48x48 pixels.",
    "Visual quality comparable to a polished, professional commercial icon library (like the flat or line icon sets built into modern software products) — not a sketch, not a detailed illustration, not clip art, not a mascot.",
  ].join(" ");
}

export interface GeneratedIconImage {
  png: Buffer;
}

interface OpenAIImagesResponse {
  data?: { b64_json?: string }[];
}

export async function generateIconImages(params: IconGenerationParams): Promise<GeneratedIconImage[]> {
  const apiKey = requireApiKey();

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: buildImagePrompt(params),
      n: params.variationCount,
      size: `${SOURCE_SIZE}x${SOURCE_SIZE}`,
      quality: "high",
      background: "opaque",
      output_format: "png",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`קריאה ל-OpenAI Image API נכשלה (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  const json = (await response.json()) as OpenAIImagesResponse;
  const images = (json.data ?? [])
    .map((item) => item.b64_json)
    .filter((b64): b64 is string => typeof b64 === "string")
    .map((b64) => Buffer.from(b64, "base64"));

  if (images.length === 0) {
    throw new Error("OpenAI לא החזיר תמונות.");
  }

  return images.map((png) => ({ png }));
}
