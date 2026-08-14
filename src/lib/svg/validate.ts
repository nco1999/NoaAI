import "server-only";
import { XMLParser } from "fast-xml-parser";
import type { IconGenerationParams } from "@/lib/supabase/types";

/**
 * Structural validation for icon SVGs, run server-side before an SVG is
 * ever returned to the client or saved to the library. Icons are produced
 * by lib/svg/vectorize.ts (deterministic raster-to-SVG tracing, not a
 * language model authoring path data), so in practice this is mostly a
 * defense-in-depth gate against bugs in that pipeline rather than against
 * an unreliable model — there is no repair round-trip for icons; anything
 * that fails here just gets the variation dropped.
 *
 * Findings are split into two buckets so callers can log/handle them
 * differently if needed:
 * - `securityErrors`: content that must never reach a browser (scripts,
 *   event handlers, external references, disallowed tags).
 * - `qualityErrors`: structural/geometric problems (wrong viewBox, element
 *   budget exceeded, coordinates far outside the canvas, wrong currentColor
 *   usage for the chosen style).
 */

export interface SvgValidationResult {
  valid: boolean;
  securityErrors: string[];
  qualityErrors: string[];
}

const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "ellipse",
]);

const FORBIDDEN_ATTR_NAMES = new Set(["style", "class", "href", "xlink:href", "target"]);
const COORD_ATTRS = new Set([
  "d",
  "points",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
]);
const OPACITY_ATTRS = new Set(["opacity", "fill-opacity", "stroke-opacity"]);
const MIN_ELEMENTS = 1;
// A traced icon can legitimately break into more disconnected regions than a
// hand-authored one would (e.g. limbs, gaps between two figures), so this is
// a generous sanity ceiling against a genuinely noisy/artifact-laden trace,
// not a "keep it simple" nudge the way it would be for model-authored paths.
const MAX_ELEMENTS = 60;
const NUMBER_RE = /-?\d+(?:\.\d+)?/g;

// Cheap raw-text pre-checks: catches the clearly malicious cases even if the
// XML parser is ever tricked, and gives fast, specific error messages.
const RAW_REJECT_PATTERNS: [RegExp, string][] = [
  [/<!doctype/i, "DOCTYPE is not allowed."],
  [/<!entity/i, "ENTITY declarations are not allowed."],
  [/<\?/, "Processing instructions are not allowed."],
  [/<script/i, "<script> is not allowed."],
  [/javascript:/i, "javascript: URLs are not allowed."],
  [/\bon[a-z-]+\s*=/i, "Event handler attributes are not allowed."],
];

type XmlNode = Record<string, unknown>;

function getTagName(node: XmlNode): string | null {
  const key = Object.keys(node).find((k) => k !== ":@" && k !== "#text");
  return key ?? null;
}

function getAttrs(node: XmlNode): Record<string, string> {
  const attrs = (node[":@"] as Record<string, unknown>) ?? {};
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    result[name] = String(value);
  }
  return result;
}

function isExternalRef(value: string): boolean {
  return /^(https?:)?\/\//i.test(value.trim()) || /^data:/i.test(value.trim());
}

export function validateIconSvg(
  svg: string,
  params: Pick<IconGenerationParams, "canvasSize" | "style" | "monochrome">
): SvgValidationResult {
  const securityErrors: string[] = [];
  const qualityErrors: string[] = [];

  for (const [pattern, message] of RAW_REJECT_PATTERNS) {
    if (pattern.test(svg)) securityErrors.push(message);
  }
  if (securityErrors.length > 0) {
    return { valid: false, securityErrors, qualityErrors };
  }

  let root: XmlNode[];
  try {
    const parser = new XMLParser({
      preserveOrder: true,
      ignoreAttributes: false,
      attributeNamePrefix: "",
      allowBooleanAttributes: false,
      processEntities: false,
      htmlEntities: false,
      ignoreDeclaration: false,
      ignorePiTags: false,
    });
    root = parser.parse(svg);
  } catch {
    return { valid: false, securityErrors: ["SVG could not be parsed."], qualityErrors };
  }

  const rootElements = root.filter((node) => getTagName(node) !== "#text");
  if (rootElements.length !== 1 || getTagName(rootElements[0]) !== "svg") {
    securityErrors.push("Document must have exactly one root <svg> element.");
    return { valid: false, securityErrors, qualityErrors };
  }

  const svgNode = rootElements[0];
  const svgAttrs = getAttrs(svgNode);

  if ("width" in svgAttrs || "height" in svgAttrs) {
    qualityErrors.push("Root <svg> must not have width/height attributes (viewBox only).");
  }

  const expectedViewBox = `0 0 ${params.canvasSize} ${params.canvasSize}`;
  if ((svgAttrs.viewBox ?? "").replace(/\s+/g, " ").trim() !== expectedViewBox) {
    qualityErrors.push(`viewBox must be exactly "${expectedViewBox}".`);
  }

  let elementCount = 0;
  const fillValues: string[] = [];
  const strokeValues: string[] = [];
  const opacityValues: number[] = [];
  const lowTolerance = -params.canvasSize * 0.25;
  const highTolerance = params.canvasSize * 1.25;

  function walk(node: XmlNode) {
    const tag = getTagName(node);
    if (tag === null) return; // text node

    if (!ALLOWED_TAGS.has(tag)) {
      securityErrors.push(`Disallowed tag: <${tag}>.`);
    } else if (tag !== "svg" && tag !== "g") {
      elementCount += 1;
    }

    const attrs = getAttrs(node);
    for (const [name, value] of Object.entries(attrs)) {
      const lowerName = name.toLowerCase();
      if (lowerName.startsWith("on")) {
        securityErrors.push(`Disallowed event handler attribute: ${name}.`);
        continue;
      }
      if (FORBIDDEN_ATTR_NAMES.has(lowerName)) {
        securityErrors.push(`Disallowed attribute: ${name}.`);
        continue;
      }
      // xmlns/xmlns:* legitimately hold the W3C namespace URL (not fetched,
      // not a hyperlink) — everything else with a URL-shaped value is not.
      const isNamespaceDecl = lowerName === "xmlns" || lowerName.startsWith("xmlns:");
      if (!isNamespaceDecl && isExternalRef(value)) {
        securityErrors.push(`Disallowed external reference in ${name}.`);
        continue;
      }

      if (lowerName === "fill" && value !== "none") fillValues.push(value);
      if (lowerName === "stroke" && value !== "none") strokeValues.push(value);
      if (OPACITY_ATTRS.has(lowerName)) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) opacityValues.push(parsed);
      }
      if (COORD_ATTRS.has(lowerName) && tag !== "svg") {
        for (const match of value.matchAll(NUMBER_RE)) {
          const num = Number(match[0]);
          if (num < lowTolerance || num > highTolerance) {
            qualityErrors.push(
              `Coordinate ${num} in ${tag}[${name}] is far outside the ${params.canvasSize}x${params.canvasSize} canvas.`
            );
          }
        }
      }
    }

    const children = (node[tag] as XmlNode[]) ?? [];
    for (const child of children) walk(child);
  }

  walk(svgNode);

  if (elementCount < MIN_ELEMENTS) {
    qualityErrors.push("Icon has no visible shape elements.");
  }
  if (elementCount > MAX_ELEMENTS) {
    qualityErrors.push(
      `Icon uses ${elementCount} shape elements; keep it to at most ${MAX_ELEMENTS} clean primitives (prefer 5-12).`
    );
  }

  const allColorValues = [...fillValues, ...strokeValues];
  const literalColors = allColorValues.filter((v) => v !== "currentColor");
  const usesCurrentColor = allColorValues.includes("currentColor");

  if (params.style === "duotone") {
    if (literalColors.length > 0) {
      qualityErrors.push("Duotone icons must use currentColor only, not literal colors.");
    }
    if (!usesCurrentColor) {
      qualityErrors.push("Duotone icons must use currentColor for both layers.");
    }
    if (opacityValues.length === 0 || !opacityValues.some((o) => o >= 0.1 && o <= 0.45)) {
      qualityErrors.push(
        "Duotone icons need a secondary layer with opacity roughly 0.2-0.35 to create the two-tone effect."
      );
    }
  } else if (params.monochrome) {
    if (literalColors.length > 0) {
      qualityErrors.push("Monochrome icons must use currentColor only, not literal hex colors.");
    }
    if (!usesCurrentColor) {
      qualityErrors.push("Monochrome icon must use currentColor for its fill/stroke.");
    }
  } else if (literalColors.length === 0) {
    qualityErrors.push("Non-monochrome icon must use at least one literal color.");
  }

  return {
    valid: securityErrors.length === 0 && qualityErrors.length === 0,
    securityErrors,
    qualityErrors,
  };
}
