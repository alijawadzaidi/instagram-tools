"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Copy text to the clipboard with a transient "copied" flag (for a checkmark)
 * and an optional success toast. Replaces the copied/setTimeout dance that was
 * inlined in the transcribe and hashtags tools.
 */
export function useCopyToClipboard(resetMs = 1500) {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(
    async (text: string, successMessage?: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (successMessage) toast.success(successMessage);
      setTimeout(() => setCopied(false), resetMs);
    },
    [resetMs],
  );

  return { copied, copy };
}
