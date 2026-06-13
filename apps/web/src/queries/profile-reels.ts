/**
 * Shared infinite query for a profile's reels — cursor pagination + cross-page
 * shortcode de-dupe in ONE place. Four tools (profile, hashtags, ranking,
 * export) consume this, so they share the cache: load reels in one, switch to
 * another, and they're already there.
 *
 * Replaces the handleFind/loadMore/de-dupe block that was copy-pasted across
 * those four pages (see Architecture/04, Research/06-restructure/01).
 */

import { infiniteQueryOptions } from "@tanstack/react-query";

import { fetchProfileReels, type ReelSummary } from "@/lib/api";

/** Normalize "@NatGeo " -> "natgeo" so cache keys collapse across tools. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export const profileReelsKeys = {
  all: ["profile-reels"] as const,
  user: (username: string) => ["profile-reels", username] as const,
};

export function profileReelsQuery(username: string) {
  return infiniteQueryOptions({
    queryKey: profileReelsKeys.user(username),
    queryFn: ({ pageParam }) => fetchProfileReels(username, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    // Don't fire until a username is committed.
    enabled: username.length > 0,
    // Flatten pages + de-dupe once, here, so every consumer gets a clean list.
    select: (data) => {
      const seen = new Set<string>();
      const reels: ReelSummary[] = [];
      for (const page of data.pages) {
        for (const r of page.reels) {
          if (!seen.has(r.shortcode)) {
            seen.add(r.shortcode);
            reels.push(r);
          }
        }
      }
      return reels;
    },
  });
}
