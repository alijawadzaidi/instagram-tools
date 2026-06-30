import Link from "next/link";
import { ArrowRight, BarChart3, Camera, Download, FileText } from "lucide-react";

import { tools, toolHref } from "@/features/registry";
import { Band } from "@/components/band";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LandingPage() {
  const liveCount = tools.filter((t) => t.status === "live").length;

  return (
    <div className="bg-background flex min-h-svh flex-col">
      {/* Nav */}
      <header className="bg-card/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Camera className="size-4" />
            </span>
            <span className="body-md-strong">Instagram Tools</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" render={<Link href="#tools" />}>
              Tools
            </Button>
            <ModeToggle />
            <Button size="sm" render={<Link href="/dashboard" />}>
              Open dashboard
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero band — sage canvas, weight-800 display */}
        <Band variant="sage" className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="positive" className="mb-5">
              {liveCount} tools live · no login required
            </Badge>
            <h1 className="display-xl text-balance">
              Pull any Instagram reel apart
            </h1>
            <p className="body-lg text-muted-foreground mx-auto mt-5 max-w-2xl text-pretty">
              Transcribe, analyze, and download — built on transcripts nobody
              else exposes. Paste a link and go.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="body-md-strong h-11 px-6"
                render={<Link href="/dashboard" />}
              >
                Open the toolset <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="tertiary"
                className="body-md-strong h-11 px-6"
                render={<Link href="#tools" />}
              >
                Browse tools
              </Button>
            </div>
          </div>
        </Band>

        {/* Feature trio — white band, showcasing the card variants */}
        <Band variant="white">
          <div className="grid gap-4 md:grid-cols-3">
            <Card variant="sage">
              <CardHeader>
                <FileText className="size-6" />
                <CardTitle className="display-xs mt-3">Transcribe reels</CardTitle>
                <CardDescription className="body-md">
                  Turn spoken audio into searchable text — the foundation
                  everything else is built on.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card variant="green">
              <CardHeader>
                <BarChart3 className="size-6" />
                <CardTitle className="display-xs mt-3">Analyze profiles</CardTitle>
                <CardDescription className="body-md">
                  Top reels, hashtags, posting cadence, and an at-a-glance
                  overview of any public account.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card variant="dark">
              <CardHeader>
                <Download className="size-6" />
                <CardTitle className="display-xs mt-3">Download anything</CardTitle>
                <CardDescription className="body-md text-canvas-soft/80">
                  Covers, reels, and bulk exports — grab the media you need in a
                  couple of clicks.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Band>

        {/* Tool grid — sage band, white cards */}
        <Band variant="sage" id="tools">
          <div className="mb-8">
            <h2 className="display-md">Everything in the box</h2>
            <p className="body-md text-muted-foreground mt-2">
              Each tool runs on its own — pick one to get started.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => {
              const isSoon = tool.status === "soon";
              const Icon = tool.icon;

              const card = (
                <Card className="group h-full transition-colors hover:border-foreground/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
                        <Icon className="size-5" />
                      </div>
                      {isSoon ? (
                        <Badge variant="secondary">Soon</Badge>
                      ) : (
                        <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                      )}
                    </div>
                    <CardTitle className="display-xs mt-3">{tool.name}</CardTitle>
                    <CardDescription className="body-sm">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );

              return isSoon ? (
                <div key={tool.slug} className="cursor-not-allowed opacity-70">
                  {card}
                </div>
              ) : (
                <Link
                  key={tool.slug}
                  href={toolHref(tool.slug)}
                  className="block"
                >
                  {card}
                </Link>
              );
            })}
          </div>
        </Band>

        {/* Closing CTA — polarity-flipped dark band, lime headline */}
        <Band variant="dark" className="text-center">
          <h2 className="display-md mx-auto max-w-2xl">Start pulling reels apart.</h2>
          <p className="body-lg text-canvas-soft/80 mx-auto mt-4 max-w-xl">
            No account needed to try the free tools.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              className="body-md-strong h-11 px-6"
              render={<Link href="/dashboard" />}
            >
              Open the toolset <ArrowRight className="size-4" />
            </Button>
          </div>
        </Band>
      </main>

      <footer className="bg-ink text-canvas-soft">
        <div className="body-sm mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
          <span>Instagram Tools</span>
          <Link href="/dashboard" className="hover:text-primary">
            Open dashboard →
          </Link>
        </div>
      </footer>
    </div>
  );
}
