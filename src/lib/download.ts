"use client";

/** Trigger a browser download of a Blob (client-only). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, filename: string, mime = "image/svg+xml") {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

/** Download a base64 data: URI (e.g. a generated background PNG) without re-fetching it. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
