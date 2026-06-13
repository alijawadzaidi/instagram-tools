"use client";

import { Check, Eye, Loader2 } from "lucide-react";

import type { ReelSummary } from "@/lib/api";
import { formatCompact } from "@/lib/format";
import { InstagramImage } from "@/components/instagram-image";
import { HashtagChips } from "@/components/hashtag-chips";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { ReelState } from "../hooks/use-batch-transcribe";

/** One selectable reel tile in the Profile Reels grid. */
export function ReelCard({
  reel,
  isSelected,
  state,
  onToggle,
}: {
  reel: ReelSummary;
  isSelected: boolean;
  state?: ReelState;
  onToggle: () => void;
}) {
  return (
    <Card
      onClick={onToggle}
      className={`cursor-pointer overflow-hidden p-0 transition-all ${
        isSelected ? "ring-primary ring-2" : "hover:border-foreground/20"
      }`}
    >
      <div className="relative aspect-[9/16] max-h-64 w-full bg-muted">
        <InstagramImage
          src={reel.thumbnail_url}
          className="h-full w-full object-cover"
        />
        <div
          className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-2 ${
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/80 bg-black/30"
          }`}
        >
          {isSelected && <Check className="size-3.5" />}
        </div>
        {reel.view_count != null && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
            <Eye className="size-3" /> {formatCompact(reel.view_count)}
          </div>
        )}
        {state && state.status !== "idle" && (
          <div className="absolute left-2 top-2">
            {state.status === "done" ? (
              <Badge className="bg-green-600 text-white">Done</Badge>
            ) : state.status === "error" ? (
              <Badge variant="destructive">Error</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="size-3 animate-spin" />
                {state.status}
              </Badge>
            )}
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {reel.caption || "(no caption)"}
        </p>
        {(reel.hashtags?.length ?? 0) > 0 && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <HashtagChips hashtags={reel.hashtags ?? []} size="sm" />
          </div>
        )}
        {state?.status === "done" && (
          <p className="mt-2 max-h-28 overflow-y-auto rounded bg-muted p-2 text-xs">
            {state.text || "(no speech detected)"}
          </p>
        )}
        {state?.status === "error" && (
          <p className="text-destructive mt-2 text-xs">{state.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
