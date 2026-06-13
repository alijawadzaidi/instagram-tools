import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { tools, toolHref } from "@/features/registry";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your Instagram toolset</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick a tool to get started. More are on the way.
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
            <Link key={tool.slug} href={toolHref(tool.slug)} className="block">
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
