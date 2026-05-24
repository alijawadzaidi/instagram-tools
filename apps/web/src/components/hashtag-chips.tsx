"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Renders hashtags as clickable chips (click to copy one) + a "copy all" button. */
export function HashtagChips({
  hashtags,
  size = "default",
}: {
  hashtags: string[];
  size?: "default" | "sm";
}) {
  const [copied, setCopied] = React.useState(false);

  if (!hashtags || hashtags.length === 0) {
    return <p className="text-muted-foreground text-xs">No hashtags in the caption.</p>;
  }

  async function copyOne(tag: string) {
    await navigator.clipboard.writeText(tag);
    toast.success(`Copied ${tag}`);
  }

  async function copyAll() {
    await navigator.clipboard.writeText(hashtags.join(" "));
    setCopied(true);
    toast.success(`Copied ${hashtags.length} hashtags`);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hashtags.map((tag) => (
        <button key={tag} type="button" onClick={() => copyOne(tag)} title="Click to copy">
          <Badge
            variant="secondary"
            className={`hover:bg-secondary/70 cursor-pointer ${size === "sm" ? "text-[10px]" : ""}`}
          >
            {tag}
          </Badge>
        </button>
      ))}
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={copyAll}>
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        Copy all
      </Button>
    </div>
  );
}
