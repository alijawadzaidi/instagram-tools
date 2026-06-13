"use client";

/**
 * The username-search + reel-listing behavior shared by the profile, hashtags,
 * ranking, and export tools. Owns the input field state, fires the shared
 * infinite query on submit, and toasts on error — the block that used to be
 * copy-pasted (handleFind/loadMore/de-dupe) four times.
 *
 * Usage:
 *   const s = useProfileReelsSearch();
 *   <form onSubmit={s.onSubmit}> ...bind s.username/s.setUsername... </form>
 *   {s.reels.map(...)}  {s.hasMore && <button onClick={s.loadMore}>}
 */

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import {
  normalizeUsername,
  profileReelsQuery,
} from "@/queries/profile-reels";

export function useProfileReelsSearch() {
  const [username, setUsername] = React.useState("");
  const [activeUser, setActiveUser] = React.useState("");

  const query = useInfiniteQuery(profileReelsQuery(activeUser));

  // Surface load failures the same way the pages did before (a toast), once per
  // error, while keeping the data layer declarative.
  React.useEffect(() => {
    if (!query.error) return;
    const msg =
      query.error instanceof ApiError || query.error instanceof Error
        ? query.error.message
        : "Couldn't load that profile.";
    toast.error(msg);
  }, [query.error]);

  const reels = query.data ?? [];

  const onSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const u = normalizeUsername(username);
      if (!u) return;
      setActiveUser(u);
    },
    [username],
  );

  return {
    username,
    setUsername,
    activeUser,
    reels,
    /** True only for the first page load (search), not "load more". */
    isLoading: query.isLoading && activeUser.length > 0,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    onSubmit,
  };
}
