import type { ReelSummary } from "@/lib/api";
import { downloadBlob } from "@/lib/download";

/** Turn a profile's reels into CSV or Markdown for offline research. */

function postedDate(taken_at: number | null): string {
  if (!taken_at) return "";
  return new Date(taken_at * 1000).toISOString().slice(0, 10);
}

function oneLine(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

const COLUMNS = ["shortcode", "url", "posted", "views", "hashtags", "caption"] as const;

function rowOf(r: ReelSummary): Record<(typeof COLUMNS)[number], string> {
  return {
    shortcode: r.shortcode,
    url: r.url,
    posted: postedDate(r.taken_at),
    views: r.view_count != null ? String(r.view_count) : "",
    hashtags: (r.hashtags ?? []).join(" "),
    caption: oneLine(r.caption),
  };
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function reelsToCsv(reels: ReelSummary[]): string {
  const header = COLUMNS.join(",");
  const lines = reels.map((r) => {
    const row = rowOf(r);
    return COLUMNS.map((c) => csvEscape(row[c])).join(",");
  });
  return [header, ...lines].join("\n");
}

export function reelsToMarkdown(reels: ReelSummary[]): string {
  const header = `| # | Posted | Views | Hashtags | Caption | Link |`;
  const sep = `|---|---|---|---|---|---|`;
  const mdEscape = (s: string) => s.replace(/\|/g, "\\|");
  const lines = reels.map((r, i) => {
    const row = rowOf(r);
    return `| ${i + 1} | ${row.posted} | ${row.views} | ${mdEscape(row.hashtags)} | ${mdEscape(
      row.caption,
    )} | [link](${row.url}) |`;
  });
  return [header, sep, ...lines].join("\n");
}

/** Re-export so the view imports one module. Thin wrapper over the shared util. */
export function downloadText(filename: string, text: string, mime: string) {
  downloadBlob(filename, text, mime);
}
