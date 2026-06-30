"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Lock, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { ApiError, imageDownloadUrl } from "@/lib/api";
import { formatCompact } from "@/lib/format";
import { triggerBrowserDownload } from "@/lib/download";
import { profileInfoQuery } from "@/queries/profile-info";
import { normalizeUsername } from "@/queries/profile-reels";
import { ToolPageShell } from "@/components/tool-page-shell";
import { UsernameSearchForm } from "@/components/username-search-form";
import { InstagramImage } from "@/components/instagram-image";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { overviewMeta } from "../meta";

export function OverviewView() {
  const [username, setUsername] = React.useState("");
  const [activeUser, setActiveUser] = React.useState("");

  const { data: info, isLoading, error } = useQuery(profileInfoQuery(activeUser));

  React.useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : "Couldn't load that profile.");
  }, [error]);

  function handleFind(e: React.FormEvent) {
    e.preventDefault();
    const u = normalizeUsername(username);
    if (!u) return;
    setActiveUser(u);
  }

  function downloadPic() {
    if (!info?.profile_pic_url) return;
    triggerBrowserDownload(
      imageDownloadUrl(info.profile_pic_url, `${info.username}-avatar.jpg`),
    );
    toast.info("Downloading profile picture…");
  }

  return (
    <ToolPageShell
      className="max-w-3xl"
    >
      <UsernameSearchForm
        value={username}
        onChange={setUsername}
        onSubmit={handleFind}
        loading={isLoading}
        description="Public account info (works for private accounts too)."
        buttonIcon={overviewMeta.icon}
        buttonLabel="Look up"
      />

      {info && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <InstagramImage
                src={info.profile_pic_url}
                className="size-20 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-lg font-semibold">{info.full_name || info.username}</span>
                  {info.is_verified && <BadgeCheck className="size-4 shrink-0 text-info" />}
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
              <StatCard center label="followers" value={formatCompact(info.follower_count)} />
              <StatCard center label="following" value={formatCompact(info.following_count)} />
              <StatCard center label="posts" value={formatCompact(info.post_count)} />
            </div>

            {info.profile_pic_url && (
              <Button variant="secondary" className="mt-4" onClick={downloadPic}>
                <Download className="size-4" /> Download profile picture
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </ToolPageShell>
  );
}
