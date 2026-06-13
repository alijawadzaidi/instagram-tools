#!/usr/bin/env node
/**
 * Scaffold a new tool end to end — the "adding a tool" recipe from
 * Architecture/04 §4, automated. Creates the backend module
 * (tools/<slug>/{schemas,service,router}.py), the frontend feature
 * (features/<slug>/{meta,components,queries,index}), the route shell, and wires
 * it into the registry.
 *
 *   pnpm new-tool <slug> [--name "Display Name"] [--desc "One-liner"]
 *
 * slug must be a valid identifier: lowercase, starts with a letter, words joined
 * by underscores (it's a Python module name and a URL segment).
 *
 * After running: `pnpm gen` (regenerate the typed client), then fill in the
 * TODOs in service.py and the view.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = path.join(ROOT, "apps/api/app");
const WEB = path.join(ROOT, "apps/web/src");

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// ---- args ----
const args = process.argv.slice(2);
const slug = args[0];
const getFlag = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!slug || slug.startsWith("-")) fail("Usage: pnpm new-tool <slug> [--name ...] [--desc ...]");
if (!/^[a-z][a-z0-9_]*$/.test(slug)) fail(`Invalid slug "${slug}". Use lowercase letters/digits/underscores, starting with a letter.`);

const pascal = slug.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const camel = pascal[0].toLowerCase() + pascal.slice(1);
const name = getFlag("--name") ?? slug.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const desc = getFlag("--desc") ?? `TODO: describe the ${name} tool.`;

// ---- guards ----
const backendDir = path.join(API, "tools", slug);
const featureDir = path.join(WEB, "features", slug);
if (fs.existsSync(backendDir)) fail(`Backend module already exists: ${path.relative(ROOT, backendDir)}`);
if (fs.existsSync(featureDir)) fail(`Feature already exists: ${path.relative(ROOT, featureDir)}`);

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`  + ${path.relative(ROOT, file)}`);
};

// ---- backend ----
write(path.join(backendDir, "__init__.py"), "");

write(
  path.join(backendDir, "schemas.py"),
  `"""Request/response models for the ${name} tool. The type source of truth —
the TS client is generated from these (run \`pnpm gen\`)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ${pascal}Request(BaseModel):
    input: str = Field(..., description="TODO: the tool's input.")


class ${pascal}Response(BaseModel):
    result: str
`,
);

write(
  path.join(backendDir, "service.py"),
  `"""${name} service — the product logic, separate from HTTP transport.

Compose integrations/, providers/, media/, core/cache here. Raise ToolError
subclasses for expected failures (the global handler turns them into responses).
"""

from __future__ import annotations


def run(value: str) -> dict:
    # TODO: implement the ${name} logic.
    return {"result": value}
`,
);

write(
  path.join(backendDir, "router.py"),
  `"""HTTP endpoints for the ${name} tool.

POST /tools/${slug}  -> run the tool

Plain \`def\` handler: blocking work runs on FastAPI's thread pool, not the event
loop. For long work, enqueue a job instead (see tools/transcribe + app/jobs).
ToolError is handled globally in main.py.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import require_internal_key

from . import service
from .schemas import ${pascal}Request, ${pascal}Response

router = APIRouter(
    prefix="/tools/${slug}",
    tags=["${slug}"],
    dependencies=[Depends(require_internal_key)],
)


@router.post("", response_model=${pascal}Response)
def run(req: ${pascal}Request) -> ${pascal}Response:
    return ${pascal}Response(**service.run(req.input))
`,
);

// ---- frontend ----
write(
  path.join(featureDir, "meta.ts"),
  `import { Wrench } from "lucide-react";

import type { ToolMeta } from "@/lib/tool-meta";

export const ${camel}Meta: ToolMeta = {
  slug: "${slug}",
  name: "${name}",
  description: "${desc}",
  icon: Wrench, // TODO: pick an icon (lucide-react)
  status: "live",
};
`,
);

write(
  path.join(featureDir, "queries.ts"),
  `import { useMutation } from "@tanstack/react-query";

// After \`pnpm gen\`, the SDK exports ${camel}Run (from the POST /tools/${slug} op).
import { ${camel}Run } from "@repo/api-client";

export function use${pascal}() {
  return useMutation({
    mutationFn: (input: string) => ${camel}Run({ body: { input } }).then((r) => r.data),
  });
}
`,
);

write(
  path.join(featureDir, "components", `${slug}-view.tsx`),
  `"use client";

import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { ToolPageShell } from "@/components/tool-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ${camel}Meta } from "../meta";
import { use${pascal} } from "../queries";

export function ${pascal}View() {
  const [input, setInput] = React.useState("");
  const run = use${pascal}();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run.mutate(input, {
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Something went wrong."),
    });
  }

  return (
    <ToolPageShell
      icon={${camel}Meta.icon}
      title={${camel}Meta.name}
      description={${camel}Meta.description}
      className="max-w-2xl"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">TODO: input</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="..."
              disabled={run.isPending}
              className="flex-1"
            />
            <Button type="submit" disabled={run.isPending || !input.trim()}>
              {run.isPending ? "Working…" : "Run"}
            </Button>
          </form>

          {run.data && (
            <p className="mt-4 text-sm">{run.data.result}</p>
          )}
        </CardContent>
      </Card>
    </ToolPageShell>
  );
}
`,
);

write(
  path.join(featureDir, "index.ts"),
  `export { ${camel}Meta as meta } from "./meta";
export { ${pascal}View } from "./components/${slug}-view";
`,
);

write(
  path.join(WEB, "app/(dashboard)/tools", slug, "page.tsx"),
  `import type { Metadata } from "next";

import { ${pascal}View, meta } from "@/features/${slug}";

export const metadata: Metadata = { title: \`\${meta.name} · Instagram Tools\` };

export default function Page() {
  return <${pascal}View />;
}
`,
);

// ---- patch the registry ----
const registryPath = path.join(WEB, "features/registry.ts");
let registry = fs.readFileSync(registryPath, "utf8");
const importLine = `import { ${camel}Meta } from "./${slug}/meta";`;
if (!registry.includes(importLine)) {
  // add after the last `import { ...Meta } from "./.../meta";`
  const lastImport = [...registry.matchAll(/import \{ \w+Meta \} from "\.\/[\w-]+\/meta";\n/g)].pop();
  if (!lastImport) fail("Couldn't find the meta imports in features/registry.ts — add the tool manually.");
  const at = lastImport.index + lastImport[0].length;
  registry = registry.slice(0, at) + importLine + "\n" + registry.slice(at);
  // add to the tools array (before the closing `];`)
  registry = registry.replace(/(\n\];)/, `\n  ${camel}Meta,$1`);
  fs.writeFileSync(registryPath, registry);
  console.log(`  ~ ${path.relative(ROOT, registryPath)} (registered ${camel}Meta)`);
}

console.log(`\n✓ Scaffolded "${slug}". Next:`);
console.log(`  1. pnpm gen                      # regenerate the typed client (${camel}Run)`);
console.log(`  2. implement apps/api/app/tools/${slug}/service.py`);
console.log(`  3. flesh out apps/web/src/features/${slug}/components/${slug}-view.tsx`);
console.log(`  4. pick an icon in features/${slug}/meta.ts\n`);
