import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { IconGenerationParams, IconVariation } from "@/lib/supabase/types";

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

const SUBMIT_TOOL_NAME = "submit_icon_variations";

const submitVariationsTool: Anthropic.Tool = {
  name: SUBMIT_TOOL_NAME,
  description:
    "Submit the generated SVG icon variations. Must be called exactly once with all variations.",
  input_schema: {
    type: "object",
    properties: {
      variations: {
        type: "array",
        description: "Each item is one complete, standalone, valid SVG icon.",
        items: {
          type: "object",
          properties: {
            svg: {
              type: "string",
              description: "A complete <svg>...</svg> markup string for one icon variation.",
            },
          },
          required: ["svg"],
        },
      },
    },
    required: ["variations"],
  },
};

function buildSystemPrompt(params: IconGenerationParams): string {
  const colorInstruction = params.monochrome
    ? `Monochrome icon: use \`currentColor\` for every fill/stroke that should carry color, so the color can be swapped later by the caller. Do not hardcode any hex colors.`
    : `Use exactly these colors where relevant, as literal hex values (not currentColor): ${params.colors.join(", ")}.`;

  const styleInstruction: Record<IconGenerationParams["style"], string> = {
    outline: `Outline style: shapes are unfilled ("fill: none" or omit fill), strokes only, stroke-width="${params.strokeWidth}", stroke-linecap="round", stroke-linejoin="round".`,
    filled: `Filled style: solid filled shapes, no visible strokes (or fill: none is not used).`,
    duotone: `Duotone style: two-layer icon combining a filled background shape at reduced opacity with an outlined/filled foreground shape in the primary color, to create a two-tone effect.`,
  };

  return [
    "You are an expert SVG icon designer producing clean, production-ready vector icons for a corporate training-content platform.",
    "",
    "Hard requirements for every SVG you produce:",
    `- Root <svg> must have viewBox="0 0 ${params.canvasSize} ${params.canvasSize}" and no width/height attributes, so it scales freely.`,
    "- No embedded raster images, no external references (no <image>, no url() to external resources), no <script>, no <style> blocks, no comments, no XML declaration.",
    "- Use only path/shape elements (path, circle, rect, line, polygon, polyline, ellipse, g).",
    "- Keep markup minimal and clean (no editor cruft, no unnecessary groups or ids).",
    `- ${colorInstruction}`,
    `- ${styleInstruction[params.style]}`,
    `- Produce exactly ${params.variationCount} variations that are visually distinct interpretations of the same prompt (different compositions or line work), not trivial recolors of each other.`,
    "",
    `Call the ${SUBMIT_TOOL_NAME} tool exactly once with all variations. Do not output any other text.`,
  ].join("\n");
}

function extractVariations(message: Anthropic.Message): IconVariation[] {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === SUBMIT_TOOL_NAME
  );

  if (!toolUse) {
    throw new Error("The model did not return any icon variations. Try rephrasing the prompt.");
  }

  const input = toolUse.input as { variations?: { svg?: string }[] };
  const variations = (input.variations ?? [])
    .map((v) => v.svg)
    .filter((svg): svg is string => typeof svg === "string" && svg.includes("<svg"));

  if (variations.length === 0) {
    throw new Error("The model returned no valid SVG markup. Try rephrasing the prompt.");
  }

  return variations.map((svg) => ({ id: crypto.randomUUID(), svg }));
}

export async function generateIconVariations(
  params: IconGenerationParams
): Promise<IconVariation[]> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(params),
    tools: [submitVariationsTool],
    tool_choice: { type: "tool", name: SUBMIT_TOOL_NAME },
    messages: [{ role: "user", content: `Icon prompt: ${params.prompt}` }],
  });

  return extractVariations(message);
}

export async function refineIconVariation(
  params: IconGenerationParams,
  previousSvg: string,
  refinementPrompt: string
): Promise<IconVariation> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: buildSystemPrompt({ ...params, variationCount: 1 }),
    tools: [submitVariationsTool],
    tool_choice: { type: "tool", name: SUBMIT_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          `Original icon prompt: ${params.prompt}`,
          `Existing SVG to refine:\n${previousSvg}`,
          `Refinement instructions: ${refinementPrompt}`,
          "Submit exactly one updated variation.",
        ].join("\n\n"),
      },
    ],
  });

  const [variation] = extractVariations(message);
  return variation;
}
