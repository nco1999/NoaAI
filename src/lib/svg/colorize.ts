const COLOR_ATTR = /(fill|stroke)=["']([^"']+)["']/g;
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const IGNORED_VALUES = new Set(["none", "currentColor", "transparent"]);

/** Distinct literal hex colors used in fill/stroke attributes (ignores currentColor/none). */
export function extractColors(svg: string): string[] {
  const found = new Set<string>();
  for (const match of svg.matchAll(COLOR_ATTR)) {
    const value = match[2];
    if (!IGNORED_VALUES.has(value) && HEX_COLOR.test(value)) {
      found.add(value.toLowerCase());
    }
  }
  return Array.from(found);
}

/** Replace one literal color everywhere it's used as a fill/stroke value. Pure string op, no AI call. */
export function replaceColor(svg: string, fromColor: string, toColor: string): string {
  const escaped = fromColor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`((?:fill|stroke)=["'])${escaped}(["'])`, "gi");
  return svg.replace(pattern, `$1${toColor}$2`);
}

/** Bake a concrete color into every `currentColor` usage, for standalone export (download/PNG). */
export function bakeCurrentColor(svg: string, color: string): string {
  return svg.replaceAll("currentColor", color);
}

/** Whether the SVG relies on `currentColor` (i.e. was generated as monochrome). */
export function usesCurrentColor(svg: string): boolean {
  return svg.includes("currentColor");
}
