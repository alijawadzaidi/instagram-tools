"use client";

import * as React from "react";
import { IdCard, Loader2, BadgeCheck, Lock, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { fetchProfileInfo, imageDownloadUrl, type ProfileInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function compact(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

export default function ProfileOverviewPage() {
  const [username, setUsername] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [info, setInfo] = React.useState<ProfileInfo | null>(null);

  async function handleFind(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().replace(/^@/, "");
    if (!u) return;
    setLoading(true);
    setInfo(null);
    try {
      setInfo(await fetchProfileInfo(u));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load that profile.");
    } finally {
      setLoading(false);
    }
  }

  function downloadPic() {
    if (!info?.profile_pic_url) return;
    const a = document.createElement("a");
    a.href = imageDownloadUrl(info.profile_pic_url, `${info.username}-avatar.jpg`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.info("Downloading profile picture…");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <IdCard className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Profile Overview</h1>
          <p className="text-muted-foreground text-sm">
            A quick audit of any public account: followers, bio, and profile picture.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instagram username</CardTitle>
          <CardDescription>Public account info (works for private accounts too).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFind} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">@</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                disabled={loading}
                className="pl-7"
              />
            </div>
            <Button type="submit" disabled={loading || !username.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <IdCard className="size-4" />}
              Look up
            </Button>
          </form>
        </CardContent>
      </Card>

      {info && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {info.profile_pic_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.profile_pic_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-20 shrink-0 rounded-full object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-lg font-semibold">{info.full_name || info.username}</span>
                  {info.is_verified && <BadgeCheck className="size-4 shrink-0 text-sky-500" />}
                  {info.is_private && <Lock className="text-muted-foreground size-3.5 shrink-0" />}
                </div>
                <div className="text-muted-foreground text-sm">@{info.username}</div>
                {info.category && (
                  <div className="text-muted-foreground mt-0.5 text-xs">{info.category}</div>
                )}
                {info.biography && (
                  <p className="mt-2 whitespace-pre-line text-sm">{info.biography}</p>
                )}
                {info.external_url && (
                  <a
                    href={info.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary mt-1 inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    {info.external_url.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="followers" value={compact(info.follower_count)} />
              <Stat label="following" value={compact(info.following_count)} />
              <Stat label="posts" value={compact(info.post_count)} />
            </div>

            {info.profile_pic_url && (
              <Button variant="secondary" className="mt-4" onClick={downloadPic}>
                <Download className="size-4" /> Download profile picture
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
