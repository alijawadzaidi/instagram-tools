"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { downloadFileUrl, type QualityOption } from "@/lib/api";
import { formatsQuery } from "@/queries/formats";
import { Button } from "@/components/ui/button";

const DEFAULT_QUALITIES: QualityOption[] = [
  { id: "best", label: "Best available", width: null, height: null, filesize: null },
];

function prettySize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? ` · ${mb.toFixed(1)} MB` : ` · ${(bytes / 1024).toFixed(0)} KB`;
}

/** Quality dropdown + download button for a single reel URL. */
export function DownloadControl({ url }: { url: string }) {
  const { data, isFetching: loadingFormats } = useQuery(formatsQuery(url));
  const [selected, setSelected] = React.useState("best");

  // Reset the choice when the reel changes (adjust-state-on-prop-change, the
  // React-recommended alternative to an effect). Defaults cover failures —
  // Best/Audio still work via the yt-dlp fallback.
  const [prevUrl, setPrevUrl] = React.useState(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    setSelected("best");
  }

  const qualities = data?.qualities.length ? data.qualities : DEFAULT_QUALITIES;
  const audioAvailable = data?.audio_available ?? false;

  function handleDownload() {
    const a = document.createElement("a");
    a.href = downloadFileUrl(url, selected);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.info("Preparing your download… it'll start shortly.");
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        {qualities.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
            {prettySize(q.filesize)}
          </option>
        ))}
        {audioAvailable && <option value="audio">Audio only (MP3)</option>}
      </select>
      <Button variant="secondary" onClick={handleDownload}>
        {loadingFormats ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Download
      </Button>
    </div>
  );
}
