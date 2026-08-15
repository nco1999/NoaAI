import "server-only";
import type {
  BackgroundDensity,
  BackgroundGenerationParams,
  BackgroundStyle,
  BackgroundTextZone,
  IconGenerationParams,
} from "@/lib/supabase/types";

// GPT Image 2 is OpenAI's current image generation model as of writing.
// Configurable via env so it can be bumped without a code change when a
// newer GPT Image model ships.
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const REQUEST_TIMEOUT_MS = 90_000;

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY. Set it in .env.local (see .env.example).");
  }
  return key;
}

/**
 * Turns an OpenAI error response into a short, actionable Hebrew message —
 * never the raw JSON/text body (that only goes to the server log). Codes
 * are matched loosely since exact error shapes drift between API versions.
 */
function classifyOpenAIError(status: number, rawBody: string): string {
  let code = "";
  let type = "";
  let message = "";
  try {
    const parsed = JSON.parse(rawBody) as { error?: { code?: string; type?: string; message?: string } };
    code = parsed.error?.code ?? "";
    type = parsed.error?.type ?? "";
    message = parsed.error?.message ?? "";
  } catch {
    // rawBody wasn't JSON; fall through to status-based classification.
  }
  const haystack = `${code} ${type} ${message}`.toLowerCase();

  if (status === 401 || haystack.includes("api key") || haystack.includes("authentication")) {
    return "בעיה בהגדרת מפתח ה-API של ספק ה-AI. יש לבדוק את הגדרת OPENAI_API_KEY בשרת.";
  }
  if (haystack.includes("quota") || haystack.includes("billing")) {
    return "נגמר התקציב (quota) בחשבון ה-AI, או שיש בעיית חיוב. יש לבדוק את חשבון OpenAI.";
  }
  if (status === 429) {
    return "יותר מדי בקשות לספק ה-AI כרגע. נסי שוב בעוד רגע.";
  }
  if (haystack.includes("content_policy") || haystack.includes("safety")) {
    return "הבקשה נחסמה על ידי מדיניות התוכן של ספק ה-AI. נסי לנסח את הפרומפט אחרת.";
  }
  if (status >= 500) {
    return "ספק ה-AI אינו זמין כרגע. נסי שוב בעוד כמה דקות.";
  }
  return "יצירת התמונה נכשלה. נסי לנסח את הפרומפט מחדש.";
}

interface OpenAIImagesResponse {
  data?: { b64_json?: string }[];
}

/** Low-level call shared by icon and background generation/editing. */
async function callOpenAIImages(url: string, init: RequestInit): Promise<OpenAIImagesResponse> {
  const apiKey = requireApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("הבקשה ליצירת התמונה ארכה זמן רב מדי (timeout). נסי שוב.");
    }
    console.error("OpenAI Image API network error", error);
    throw new Error("שגיאת תקשורת מול ספק ה-AI. נסי שוב.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    console.error("OpenAI Image API error", url, response.status, rawBody);
    throw new Error(classifyOpenAIError(response.status, rawBody));
  }

  return (await response.json()) as OpenAIImagesResponse;
}

function extractPngBuffers(json: OpenAIImagesResponse): Buffer[] {
  const buffers = (json.data ?? [])
    .map((item) => item.b64_json)
    .filter((b64): b64 is string => typeof b64 === "string")
    .map((b64) => Buffer.from(b64, "base64"));
  if (buffers.length === 0) {
    throw new Error("ספק ה-AI לא החזיר תמונות. נסי לנסח את הפרומפט מחדש.");
  }
  return buffers;
}

// ---------------------------------------------------------------------------
// Icons — unchanged behavior, just routed through the shared helpers above.
// ---------------------------------------------------------------------------

// Square source resolution requested from the model. The vectorizer (see
// lib/svg/vectorize.ts) only needs clean flat-color edges to trace, not
// pixel-level fidelity — the traced result is rescaled to the icon's own
// viewBox (max 64x64) afterwards regardless of source size. 512 is still
// 8x-21x the final viewBox and traces just as cleanly as 1024 did; halving
// it (and dropping quality from "high" to "medium") measurably cuts GPT
// Image latency, which is what was blowing the request timeout — see
// generateIconImage() below.
const ICON_SOURCE_SIZE = 512;
const ICON_IMAGE_QUALITY = "medium";

function strokeWeightLabel(strokeWidth: number): string {
  if (strokeWidth <= 1.5) return "very thin, delicate";
  if (strokeWidth <= 3) return "medium-weight";
  return "bold, thick";
}

function iconStyleDescription(style: IconGenerationParams["style"], strokeWidth: number): string {
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
function buildIconImagePrompt(params: IconGenerationParams): string {
  return [
    `Professional minimal icon of: ${params.prompt}.`,
    "Single subject, single concept only — nothing else in the frame.",
    "Centered composition, with a generous even margin of empty space around the subject.",
    `${iconStyleDescription(params.style, params.strokeWidth)}.`,
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

/**
 * Generates exactly ONE icon image per call (n: 1), mirroring
 * generateBackgroundImage below. Icons used to request all variations
 * (up to 4) in a single n:4 call, which made GPT Image render them
 * one-after-another server-side inside OpenAI *before ever responding* —
 * so the single 90s AbortController budget in callOpenAIImages() had to
 * cover 4x the work, and routinely tripped. Backgrounds never had this bug
 * because they always used n: 1 and let the client parallelize via
 * separate HTTP requests (see BackgroundStudio.tsx) — icons now do the
 * same (see generateIconVariation() in lib/ai/icon-generation.ts and the
 * per-slot fetches in IconStudio.tsx).
 */
export async function generateIconImage(params: IconGenerationParams): Promise<GeneratedIconImage> {
  const start = Date.now();
  const json = await callOpenAIImages("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: buildIconImagePrompt(params),
      n: 1,
      size: `${ICON_SOURCE_SIZE}x${ICON_SOURCE_SIZE}`,
      quality: ICON_IMAGE_QUALITY,
      background: "opaque",
      output_format: "png",
    }),
  });
  console.log(`[icon-gen] openai generation: ${Date.now() - start}ms`);

  const [png] = extractPngBuffers(json);
  return { png };
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

// Exact aspect-ratio pixel sizes (both dimensions divisible by 16, as
// gpt-image-2 requires for arbitrary WIDTHxHEIGHT). 16:9 matches a
// PowerPoint/Google Slides widescreen slide exactly, so it drops in with no
// crop.
const BACKGROUND_SIZE: Record<BackgroundGenerationParams["aspectRatio"], { width: number; height: number }> = {
  "16:9": { width: 1536, height: 864 },
  "4:3": { width: 1536, height: 1152 },
  "1:1": { width: 1024, height: 1024 },
  "9:16": { width: 864, height: 1536 },
};

function textZoneInstruction(zone: BackgroundTextZone): string {
  switch (zone) {
    case "right":
      return "Composition: keep the right third of the frame visually calm, low-detail, and uncluttered — that area will hold a title and text overlay. Concentrate the strongest visual interest, shapes, and detail in the left two-thirds.";
    case "left":
      return "Composition: keep the left third of the frame visually calm, low-detail, and uncluttered — that area will hold a title and text overlay. Concentrate the strongest visual interest, shapes, and detail in the right two-thirds.";
    case "center":
      return "Composition: keep a vertical band through the center of the frame visually calm and open — that area will hold a centered title and text overlay. Frame it by placing visual interest toward the left and right edges rather than the middle.";
    case "top":
      return "Composition: keep the top third of the frame visually calm, low-detail, and uncluttered — that area will hold a title. Concentrate the strongest visual interest in the lower two-thirds.";
    case "none":
      return "Composition: maintain generous, evenly distributed negative space throughout the frame so text could comfortably be placed in more than one area — avoid filling the whole frame edge-to-edge with detail.";
  }
}

function backgroundStyleInstruction(style: BackgroundStyle): string {
  switch (style) {
    case "minimal":
      return "Visual style: minimal and clean — soft flat shapes or a subtle smooth gradient, very restrained, lots of breathing room.";
    case "geometric":
      return "Visual style: abstract geometric composition — clean lines and simple shapes (circles, polygons, grids), modern and structured, not organic or hand-drawn.";
    case "gradient":
      return "Visual style: a smooth, soft, professional color gradient as the main visual element, with at most a few subtle abstract shapes layered on top — no photographic elements.";
    case "tech":
      return "Visual style: modern technological/digital feel — subtle circuit-like lines, soft glowing nodes, abstract network or data patterns, cool and precise, not cluttered or cyberpunk-busy.";
    case "organic":
      return "Visual style: soft, organic, flowing shapes and curves, warm and approachable, natural gradients — not geometric or rigid.";
  }
}

function backgroundDensityInstruction(density: BackgroundDensity): string {
  switch (density) {
    case "minimal":
      return "Visual density: very sparse — a small number of large, simple shapes/elements and a lot of empty space. Err on the side of removing elements, not adding them.";
    case "balanced":
      return "Visual density: a moderate, balanced amount of visual interest — enough to feel designed and intentional, but still clearly uncluttered.";
    case "rich":
      return "Visual density: more layered and detailed than minimal, with multiple shapes/elements creating depth — but still organized, not chaotic, and still leaving clear open space for content.";
  }
}

function backgroundColorInstruction(color: string | null): string {
  return color
    ? `Color palette: build the composition around the color ${color} as the dominant/accent color, with complementary supporting tones.`
    : "Color palette: choose a professional color palette that fits the topic well — full creative freedom here.";
}

// Every bullet here maps to an explicit requirement: this is a background
// something else gets placed on top of, not a standalone illustration.
function buildBackgroundPrompt(params: BackgroundGenerationParams): string {
  return [
    "You are creating a professional PRESENTATION BACKGROUND — the base visual layer of a slide that a title, text, icons, or charts will be placed on top of. It is not a standalone illustration.",
    `Topic / theme: ${params.prompt}.`,
    textZoneInstruction(params.textZone),
    backgroundStyleInstruction(params.style),
    backgroundDensityInstruction(params.density),
    backgroundColorInstruction(params.color),
    "Hard requirements: absolutely no text, letters, numbers, typography, or captions anywhere in the image. No logos unless explicitly requested in the topic. No watermarks or signatures. No UI elements (no buttons, no app chrome, no browser windows, no phone/screen mockups). No random floating symbols or icons unrelated to the composition. No distorted or anatomically incorrect objects. No people unless the topic specifically calls for showing people.",
    "Strong, deliberate composition with a clear visual hierarchy and generous clean negative space — it needs to work as a backdrop for real content, not compete with it.",
    "Professional corporate/presentation quality, suitable for a business or educational audience viewed on a large screen — not a busy illustration, not stock-photo clip art, not a meme.",
  ].join(" ");
}

function buildBackgroundRefinementPrompt(refinementPrompt: string): string {
  return [
    "Apply this specific change to the existing presentation background image, keeping the rest of the composition, topic, and style consistent:",
    refinementPrompt,
    "Still absolutely no text, letters, numbers, typography, logos, watermarks, or UI elements anywhere in the image. Keep it a clean, professional presentation background with generous negative space.",
  ].join(" ");
}

export interface GeneratedBackgroundImage {
  png: Buffer;
  width: number;
  height: number;
}

export async function generateBackgroundImage(
  params: BackgroundGenerationParams
): Promise<GeneratedBackgroundImage> {
  const { width, height } = BACKGROUND_SIZE[params.aspectRatio];

  const json = await callOpenAIImages("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: buildBackgroundPrompt(params),
      n: 1,
      size: `${width}x${height}`,
      quality: "high",
      background: "opaque",
      output_format: "png",
    }),
  });

  const [png] = extractPngBuffers(json);
  return { png, width, height };
}

/**
 * Refine an existing background. Uses OpenAI's images/edit endpoint (native
 * image-to-image editing) so the result stays visually anchored to the
 * original — a from-scratch regeneration with the refinement text appended
 * tends to drift into a different composition. Falls back to full
 * regeneration only if the edit call itself fails (e.g. the endpoint
 * rejects the request), so refine never hard-fails just because editing
 * isn't available.
 */
export async function editBackgroundImage(
  params: BackgroundGenerationParams,
  previousPng: Buffer,
  refinementPrompt: string
): Promise<GeneratedBackgroundImage> {
  const { width, height } = BACKGROUND_SIZE[params.aspectRatio];

  try {
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("image", new Blob([new Uint8Array(previousPng)], { type: "image/png" }), "background.png");
    form.append("prompt", buildBackgroundRefinementPrompt(refinementPrompt));
    form.append("size", `${width}x${height}`);
    form.append("n", "1");

    const json = await callOpenAIImages("https://api.openai.com/v1/images/edits", {
      method: "POST",
      body: form,
    });

    const [png] = extractPngBuffers(json);
    return { png, width, height };
  } catch (error) {
    console.error("Background edit failed, falling back to full regeneration", error);
    return generateBackgroundImage({
      ...params,
      prompt: `${params.prompt}. ${refinementPrompt}`,
    });
  }
}
