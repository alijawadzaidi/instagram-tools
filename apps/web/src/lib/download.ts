/**
 * Trigger a browser "Save as" for a URL by clicking a synthetic anchor — the
 * one trick that was hand-rolled in 5 places (cover, overview, download-control,
 * the bulk-zip flow, etc.).
 */
export function triggerBrowserDownload(href: string, filename?: string) {
  const a = document.createElement("a");
  a.href = href;
  if (filename) a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Same, for in-memory content: wraps it in a Blob, downloads, then revokes. */
export function downloadBlob(filename: string, content: BlobPart, mime: string) {
  const objUrl = URL.createObjectURL(new Blob([content], { type: mime }));
  triggerBrowserDownload(objUrl, filename);
  URL.revokeObjectURL(objUrl);
}
