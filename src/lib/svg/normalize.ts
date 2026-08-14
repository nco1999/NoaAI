import "server-only";

/**
 * Deterministic, mechanical cleanup applied before validation. These are
 * fixes that don't need a model round-trip (unlike geometry/quality
 * issues, which go through the repair call in lib/ai/anthropic.ts).
 */
export function normalizeIconSvg(svg: string): string {
  let result = svg.trim();

  // Strip an XML prolog/comments the model might still add despite
  // instructions not to.
  result = result.replace(/<\?xml[^>]*\?>/gi, "").trim();
  result = result.replace(/<!--[\s\S]*?-->/g, "").trim();

  const openTagMatch = result.match(/<svg\b([^>]*)>/i);
  if (openTagMatch) {
    let attrs = openTagMatch[1];
    if (!/\bxmlns\s*=/.test(attrs)) {
      attrs = ` xmlns="http://www.w3.org/2000/svg"${attrs}`;
    }
    result = result.slice(0, openTagMatch.index) + `<svg${attrs}>` + result.slice(openTagMatch.index! + openTagMatch[0].length);
  }

  return result;
}
