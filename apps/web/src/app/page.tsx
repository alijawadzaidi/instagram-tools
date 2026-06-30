import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera } from "lucide-react";

import { tools, toolHref } from "@/features/registry";
import { Band } from "@/components/band";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const liveCount = tools.filter((t) => t.status === "live").length;

  return (
    <div className="bg-canvas text-ink flex min-h-svh flex-col">
      {/* Utility bar */}
      <div className="bg-soft-cloud">
        <div className="caption-sm text-mute mx-auto flex h-9 w-full max-w-7xl items-center justify-end px-6">
          No login required · {liveCount} tools live
        </div>
      </div>

      {/* Primary nav */}
      <header className="border-hairline-soft bg-canvas sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-ink text-canvas flex aspect-square size-8 items-center justify-center">
              <Camera className="size-4" />
            </span>
            <span className="body-strong tracking-tight uppercase">
              Instagram Tools
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
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
        {/* Campaign hero — ink block, towering uppercase display */}
        <Band variant="dark" className="py-20 md:py-28">
          <div className="max-w-4xl">
            <span className="caption-sm text-stone tracking-[0.18em] uppercase">
              Instagram intelligence
            </span>
            <h1 className="display-campaign mt-4">
              Pull any reel apart
            </h1>
            <p className="body-md text-stone mt-6 max-w-xl">
              Transcribe, analyze, and download — built on transcripts nobody
              else exposes. Paste a link and go.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-canvas text-ink body-strong h-12 px-8 hover:bg-white/90"
                render={<Link href="/dashboard" />}
              >
                Open the toolset <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                className="text-canvas body-strong hover:bg-canvas/10 h-12 border border-white/40 bg-transparent px-8"
                render={<Link href="#tools" />}
              >
                Browse tools
              </Button>
            </div>
          </div>
        </Band>

        {/* Featured tools — flat product-card grid on white */}
        <Band variant="white" id="tools" className="py-12 md:py-16">
          <div className="border-hairline mb-8 flex items-end justify-between border-b pb-4">
            <h2 className="heading-xl tracking-tight uppercase">Featured tools</h2>
            <span className="caption-md text-mute">{tools.length} total</span>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => {
              const isSoon = tool.status === "soon";
              const Icon = tool.icon;

              const inner = (
                <>
                  <div className="bg-soft-cloud relative flex aspect-[4/3] items-center justify-center">
                    <Icon className="size-10" strokeWidth={1.5} />
                    {isSoon ? (
                      <Badge
                        variant="promo"
                        className="absolute left-3 top-3"
                      >
                        Coming soon
                      </Badge>
                    ) : (
                      <ArrowUpRight className="absolute right-3 top-3 size-5 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                  <div className="mt-3">
                    <h3 className="body-strong">{tool.name}</h3>
                    <p className="caption-md text-mute mt-1">
                      {tool.description}
                    </p>
                  </div>
                </>
              );

              return isSoon ? (
                <div
                  key={tool.slug}
                  className="cursor-not-allowed opacity-60"
                >
                  {inner}
                </div>
              ) : (
                <Link key={tool.slug} href={toolHref(tool.slug)} className="group block">
                  {inner}
                </Link>
              );
            })}
          </div>
        </Band>

        {/* Closing CTA — ink band */}
        <Band variant="dark" className="py-16 md:py-20">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <h2 className="heading-xl tracking-tight uppercase">
              Start pulling reels apart
            </h2>
            <Button
              size="lg"
              className="bg-canvas text-ink body-strong h-12 shrink-0 px-8 hover:bg-white/90"
              render={<Link href="/dashboard" />}
            >
              Open the toolset <ArrowRight className="size-4" />
            </Button>
          </div>
        </Band>
      </main>

      <footer className="border-hairline border-t">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8">
          <span className="body-strong tracking-tight uppercase">
            Instagram Tools
          </span>
          <Link href="/dashboard" className="caption-md text-mute hover:text-ink">
            Open dashboard →
          </Link>
        </div>
      </footer>
    </div>
  );
}
