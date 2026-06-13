/** Available download qualities for a single reel URL. */

import { queryOptions } from "@tanstack/react-query";

import { fetchFormats } from "@/lib/api";

export function formatsQuery(url: string | null) {
  return queryOptions({
    queryKey: ["formats", url],
    queryFn: () => fetchFormats(url as string),
    enabled: !!url,
    // Formats for a given reel don't change; cache for the session.
    staleTime: Infinity,
    // On failure the UI falls back to Best/Audio (yt-dlp handles those), so a
    // retry storm isn't worth it.
    retry: false,
  });
}
