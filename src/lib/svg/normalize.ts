import "server-only";

/**
 * Deterministic, mechanical cleanup applied to SVG markup before validation
 * (icons are vectorized from a generated image in lib/svg/vectorize.ts, not
 * hand-authored by a model, so this is just tidying the vectorizer's output).
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
