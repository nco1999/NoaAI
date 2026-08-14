import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { IconGenerationParams, IconVariation } from "@/lib/supabase/types";
import { normalizeIconSvg } from "@/lib/svg/normalize";
import { validateIconSvg, type SvgValidationResult } from "@/lib/svg/validate";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY. Set it in .env.local (see .env.example)."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SUBMIT_TOOL_NAME = "submit_icon";

/**
 * Field order matters here, not just for the schema: Claude fills a tool
 * call's JSON fields in the order they're declared, so putting the planning
 * fields (key_elements → composition_plan → draft_svg → self_check) before
 * the final `svg` field forces a plan-then-draft-then-critique-then-finalize
 * sequence *inside a single structured call*. This gets us the benefit of
 * "think before you answer" without extended thinking, which the Claude API
 * doesn't support together with forced tool_choice.
 */
const submitIconTool: Anthropic.Tool = {
  name: SUBMIT_TOOL_NAME,
  description: "Submit one finished icon, after planning its composition and self-checking it.",
  input_schema: {
    type: "object",
    properties: {
      key_elements: {
        type: "array",
        description: "The 1-3 most important visual elements that convey the concept. Nothing else.",
        items: { type: "string" },
      },
      composition_plan: {
        type: "string",
        description:
          "Brief plan for the composition: the approximate bounding box (within the safe area) for each key element, how they're aligned to each other, and the spacing between them. Written before any SVG is produced.",
      },
      draft_svg: {
        type: "string",
        description: "A first-pass complete <svg>...</svg> markup string, before self-checking.",
      },
      self_check: {
        type: "string",
        description:
          "Check draft_svg against the quality checklist (in-bounds, no clipping, no accidental crossing strokes, no floating disconnected parts, no distorted shapes, sensible proportions, readable at small size, correct style, correct currentColor usage, element count 5-12). List any problems found in draft_svg, or state 'no issues'.",
      },
      svg: {
        type: "string",
        description:
          "The FINAL complete <svg>...</svg> markup string, with every issue found in self_check corrected. This is what gets used — make sure it is fully corrected, not a copy of draft_svg.",
      },
    },
    required: ["key_elements", "composition_plan", "draft_svg", "self_check", "svg"],
  },
};

const FEW_SHOT_EXAMPLES = `
Calibration examples (these describe the LEVEL OF ABSTRACTION expected, not exact shapes to copy):
- "light bulb": a simple symmetric bulb outline (circle or rounded shape) sitting on a small rectangular base, with 2-3 short filament lines inside. Not a realistic bulb render.
- "person at a computer": a plain circle for the head, a simple trapezoid/rounded shape for the shoulders/torso, next to a simple rectangle (monitor) on a short stand. No face, no fingers, no keyboard keys.
- "document with a checkmark": a rounded rectangle (optionally with a folded corner) for the page, 1-2 short lines suggesting text, plus one clear checkmark path. Not a full page of realistic text lines.
- "person handing over a card at a kiosk": one simple abstracted person shape (circle head + simple body) next to a simple kiosk shape (rectangle/rounded rectangle), with one small rectangle (the card/ticket) positioned at the handoff point. No detailed limbs, no facial features.
`.trim();

function styleRules(style: IconGenerationParams["style"], strokeWidth: number): string {
  switch (style) {
    case "outline":
      return [
        `Outline style: every shape has fill="none". Strokes only: stroke="currentColor", stroke-width="${strokeWidth}" on every stroked element (the SAME value everywhere — never vary stroke width within one icon), stroke-linecap="round", stroke-linejoin="round".`,
        "Avoid double outlines (two strokes tracing the same edge) and avoid strokes that accidentally overlap or cross where they shouldn't.",
      ].join(" ");
    case "filled":
      return "Filled style: solid closed shapes with fill=\"currentColor\" (or the given literal colors), no stroke attributes at all. Silhouette must read clearly as flat shapes, not as outlined-then-filled shapes.";
    case "duotone":
      return [
        "Duotone style: exactly two layers, BOTH using currentColor (never literal hex colors, even if the user picked custom colors — duotone gets its two-tone look from opacity, not from a second color).",
        "Primary layer: fill=\"currentColor\" (or stroke=\"currentColor\" for line details) at full opacity, for the foreground/most important shape.",
        "Secondary layer: fill=\"currentColor\" with fill-opacity between 0.2 and 0.35, for the background/supporting shape, drawn behind the primary layer.",
      ].join(" ");
  }
}

function colorRules(style: IconGenerationParams["style"], params: IconGenerationParams): string {
  if (style === "duotone") {
    // Duotone always uses currentColor at two opacities — see styleRules().
    return "Color: governed entirely by the duotone rule above. Do not use any literal hex colors.";
  }
  if (params.monochrome) {
    return "Color: monochrome. Use currentColor for every fill/stroke that should carry color. Never hardcode a hex color.";
  }
  return `Color: use these literal hex colors where relevant (not currentColor): ${params.colors.join(", ")}.`;
}

function buildSystemPrompt(params: IconGenerationParams): string {
  const safeMin = Math.round(params.canvasSize * (4 / 48) * 10) / 10;
  const safeMax = Math.round(params.canvasSize * (44 / 48) * 10) / 10;

  return [
    "You are a professional icon designer working in the style of major production icon systems (Lucide, Material Symbols, Phosphor). You design ICONS, not illustrations.",
    "",
    "## Design targets",
    "- Clean, deliberate geometry. Symmetry wherever the subject calls for it.",
    "- Natural proportions, simple and unambiguous shapes, clear visual hierarchy.",
    "- Even, consistent spacing between elements — no crowding, no awkward gaps.",
    "- No stray or redundant lines, no strokes that cross or overlap by accident, no floating disconnected fragments, no warped/distorted shapes.",
    "- No tiny details that won't read at small size. The icon must be instantly legible at 24-48px, the same way it looks at 512px.",
    "- Prefer abstraction over anatomical detail: a person is a head + a simple body/shoulder shape + at most a simple limb. Never draw fingers, faces, or other fine anatomy.",
    "",
    "## Grid and geometry",
    `- Root <svg> viewBox="0 0 ${params.canvasSize} ${params.canvasSize}" exactly, with no width/height attributes.`,
    `- Keep every meaningful element inside the safe area, roughly ${safeMin}-${safeMax} on both axes, so nothing touches or clips at the edges.`,
    "- Build the icon from only: path, circle, rect, line, polyline, polygon (and <g> only to group, never to transform-hack a shape).",
    "- Avoid complex transforms, mask, clipPath, filters, embedded/raster images, <text>, CSS or <style> blocks, gradients, and foreignObject — none of these are needed for a clean icon.",
    "- No comments, no editor cruft, no unnecessary ids.",
    "",
    "## Complexity budget",
    "- Use as few shape primitives as make the icon read clearly — aim for 5-12 total, and never more than ~18. Prefer one well-drawn path over several small fragmented ones.",
    "",
    "## Style",
    `- ${styleRules(params.style, params.strokeWidth)}`,
    `- ${colorRules(params.style, params)}`,
    "",
    "## Process (do this, using the tool's fields in order)",
    "1. key_elements — identify the 1-3 visual elements that are actually essential to recognizing the concept. Cut everything else.",
    "2. composition_plan — decide a simple layout: an approximate bounding box for each key element inside the safe area, how they align to each other (centered, baseline-aligned, etc.), and the spacing between them.",
    "3. draft_svg — produce a first complete SVG from that plan.",
    "4. self_check — critically re-examine draft_svg against the design targets and grid rules above: everything in bounds, no clipping, no accidental crossing/overlapping strokes, no floating parts, no distorted shapes, proportions make sense, still readable if shrunk to 24px, style/color rules followed exactly. Name any problems you find, however small.",
    "5. svg — output the corrected final SVG. If self_check found nothing, this is the same as draft_svg; if it found problems, this must actually fix them, not just repeat draft_svg.",
    "",
    FEW_SHOT_EXAMPLES,
    "",
    `Call the ${SUBMIT_TOOL_NAME} tool exactly once, with all fields, for exactly one icon. Do not output any text outside the tool call.`,
  ].join("\n");
}

interface ExtractedIcon {
  svg: string;
}

function extractIcon(message: Anthropic.Message): ExtractedIcon {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === SUBMIT_TOOL_NAME
  );

  if (!toolUse) {
    throw new Error("The model did not return an icon. Try rephrasing the prompt.");
  }

  const input = toolUse.input as { svg?: string };
  if (typeof input.svg !== "string" || !input.svg.includes("<svg")) {
    throw new Error("The model returned no valid SVG markup. Try rephrasing the prompt.");
  }

  return { svg: input.svg };
}

function formatValidationErrors(result: SvgValidationResult): string {
  return [...result.securityErrors, ...result.qualityErrors].join("\n- ");
}

async function repairIconSvg(
  params: IconGenerationParams,
  brokenSvg: string,
  errors: string[]
): Promise<string | null> {
  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: buildSystemPrompt(params),
      tools: [submitIconTool],
      tool_choice: { type: "tool", name: SUBMIT_TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            `Icon prompt: ${params.prompt}`,
            `This SVG failed validation:\n${brokenSvg}`,
            `Validation errors to fix:\n- ${errors.join("\n- ")}`,
            "Fix ONLY the structure/geometry/style issues listed above. Keep the same concept and composition intent — do not redesign the icon from scratch. Go through the full process again (key_elements/composition_plan/draft_svg/self_check/svg) and make sure the final svg field actually resolves every listed error.",
          ].join("\n\n"),
        },
      ],
    });

    const { svg } = extractIcon(message);
    return normalizeIconSvg(svg);
  } catch (error) {
    console.error("Icon repair call failed", error);
    return null;
  }
}

async function generateAndValidateOne(
  params: IconGenerationParams,
  variationIndex: number,
  variationCount: number
): Promise<IconVariation | null> {
  const diversityHint =
    variationCount > 1
      ? `This is variation ${variationIndex + 1} of ${variationCount} for the same prompt. Choose a composition genuinely distinct from a generic default interpretation (different arrangement, angle, or which secondary element you include) — but keep the same subject, the same style, and the same quality bar as any other variation. Do not produce a near-duplicate of the most obvious interpretation just because it's "variation 1".`
      : "";

  let svg: string;
  let validation: SvgValidationResult;

  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: buildSystemPrompt(params),
      tools: [submitIconTool],
      tool_choice: { type: "tool", name: SUBMIT_TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [`Icon prompt: ${params.prompt}`, diversityHint].filter(Boolean).join("\n\n"),
        },
      ],
    });

    svg = normalizeIconSvg(extractIcon(message).svg);
    validation = validateIconSvg(svg, params);
  } catch (error) {
    console.error("Icon generation call failed", error);
    return null;
  }

  if (validation.securityErrors.length > 0) {
    // Fail closed: never round-trip unsafe content back through the model.
    console.error("Icon dropped for security validation errors", validation.securityErrors);
    return null;
  }

  if (!validation.valid) {
    const repaired = await repairIconSvg(params, svg, validation.qualityErrors);
    if (!repaired) return null;

    const repairedValidation = validateIconSvg(repaired, params);
    if (repairedValidation.securityErrors.length > 0 || !repairedValidation.valid) {
      console.error(
        "Icon dropped after repair still failed validation",
        formatValidationErrors(repairedValidation)
      );
      return null;
    }
    svg = repaired;
  }

  return { id: crypto.randomUUID(), svg };
}

export async function generateIconVariations(
  params: IconGenerationParams
): Promise<IconVariation[]> {
  getClient(); // fail fast on missing API key, instead of swallowing it per-variation below

  const results = await Promise.all(
    Array.from({ length: params.variationCount }, (_, i) =>
      generateAndValidateOne(params, i, params.variationCount)
    )
  );

  const variations = results.filter((v): v is IconVariation => v !== null);
  if (variations.length === 0) {
    throw new Error("יצירת האייקונים נכשלה בבדיקת התקינות. נסי לנסח את הפרומפט מחדש.");
  }
  return variations;
}

export async function refineIconVariation(
  params: IconGenerationParams,
  previousSvg: string,
  refinementPrompt: string
): Promise<IconVariation> {
  const refineParams: IconGenerationParams = { ...params, variationCount: 1 };

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: buildSystemPrompt(refineParams),
    tools: [submitIconTool],
    tool_choice: { type: "tool", name: SUBMIT_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          `Original icon prompt: ${params.prompt}`,
          `Existing SVG to refine:\n${previousSvg}`,
          `Refinement instructions: ${refinementPrompt}`,
          "Keep the same subject and composition intent; apply only the refinement requested. Still go through the full process (key_elements/composition_plan/draft_svg/self_check/svg) and make sure the result meets every design/grid/style rule above.",
        ].join("\n\n"),
      },
    ],
  });

  let svg = normalizeIconSvg(extractIcon(message).svg);
  let validation = validateIconSvg(svg, refineParams);

  if (validation.securityErrors.length > 0) {
    throw new Error("התוצאה לא עברה בדיקת אבטחה. נסי שוב.");
  }

  if (!validation.valid) {
    const repaired = await repairIconSvg(refineParams, svg, validation.qualityErrors);
    if (repaired) {
      const repairedValidation = validateIconSvg(repaired, refineParams);
      if (repairedValidation.securityErrors.length === 0 && repairedValidation.valid) {
        svg = repaired;
        validation = repairedValidation;
      }
    }
  }

  if (!validation.valid) {
    throw new Error("השיפור נכשל בבדיקת התקינות. נסי ניסוח אחר.");
  }

  return { id: crypto.randomUUID(), svg };
}
