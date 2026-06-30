import Link from "next/link";
import { ArrowRight, Camera } from "lucide-react";

import { tools, toolHref } from "@/features/registry";
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
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Camera className="size-4" />
          </span>
          <span className="font-semibold">Instagram Tools</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <Button render={<Link href="/dashboard" />}>Open dashboard</Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-4 py-20 text-center md:px-6 md:py-28">
          <Badge variant="positive" className="mb-5">
            {liveCount} tools live · no login required
          </Badge>
          <h1 className="display-xl mx-auto max-w-3xl text-balance">
            The Instagram toolset for creators
          </h1>
          <p className="body-lg text-muted-foreground mx-auto mt-5 max-w-2xl text-pretty">
            Transcribe reels, analyze profiles, download covers, and more — built
            on transcripts nobody else exposes. Paste a link and go.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              size="lg"
              className="h-10 px-5 text-sm"
              render={<Link href="/dashboard" />}
            >
              Open the toolset <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="tertiary"
              className="h-10 px-5 text-sm"
              render={<Link href="#tools" />}
            >
              Browse tools
            </Button>
          </div>
        </section>

        {/* Tool grid */}
        <section
          id="tools"
          className="mx-auto w-full max-w-5xl px-4 pb-24 md:px-6"
        >
          <div className="mb-6">
            <h2 className="display-xs">Everything in the box</h2>
            <p className="body-sm text-muted-foreground mt-1">
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
                    <CardTitle className="mt-3">{tool.name}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
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
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 text-sm md:px-6">
          <span>Instagram Tools</span>
          <Link href="/dashboard" className="hover:text-foreground">
            Open dashboard →
          </Link>
        </div>
      </footer>
    </div>
  );
}
