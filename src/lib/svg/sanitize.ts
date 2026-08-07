"use client";

import DOMPurify from "dompurify";

/**
 * Sanitize AI-generated (or library-stored) SVG markup before it's ever
 * rendered with dangerouslySetInnerHTML. Icons can be shared org-wide, so
 * this is the last line of defense against stored XSS via a crafted prompt
 * or a tampered asset — not just a formatting nicety.
 */
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ["viewBox"],
  });
}
