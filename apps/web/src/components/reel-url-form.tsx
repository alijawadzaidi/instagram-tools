"use client";

import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The "paste a reel URL + submit" card shared by the transcribe and cover
 * tools. Validation against INSTAGRAM_URL stays in the caller's submit handler.
 */
export function ReelUrlForm({
  value,
  onChange,
  onSubmit,
  loading,
  cardTitle,
  description,
  buttonIcon: ButtonIcon,
  buttonLabel,
  loadingLabel,
  placeholder = "https://www.instagram.com/reel/…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  cardTitle: string;
  description: string;
  buttonIcon: LucideIcon;
  buttonLabel: string;
  loadingLabel?: string;
  placeholder?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{cardTitle}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="url"
            inputMode="url"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !value.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ButtonIcon className="size-4" />}
            {loading && loadingLabel ? loadingLabel : buttonLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
