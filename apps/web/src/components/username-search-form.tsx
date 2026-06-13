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
 * The "@username + submit" card shared by the four profile tools (profile,
 * hashtags, ranking, export). The variable bits — card description, button
 * icon/label — are props; the @-prefixed input and layout are shared.
 */
export function UsernameSearchForm({
  value,
  onChange,
  onSubmit,
  loading,
  disabled,
  description,
  buttonIcon: ButtonIcon,
  buttonLabel,
  loadingLabel,
  cardTitle = "Instagram username",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  /** Extra disable condition beyond `loading` (e.g. a transcription in flight). */
  disabled?: boolean;
  description: string;
  buttonIcon: LucideIcon;
  buttonLabel: string;
  loadingLabel?: string;
  cardTitle?: string;
}) {
  const isDisabled = loading || disabled;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{cardTitle}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
              @
            </span>
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="username"
              disabled={isDisabled}
              className="pl-7"
            />
          </div>
          <Button type="submit" disabled={isDisabled || !value.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ButtonIcon className="size-4" />}
            {loading && loadingLabel ? loadingLabel : buttonLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
