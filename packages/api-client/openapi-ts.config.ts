import { defineConfig } from "@hey-api/openapi-ts";

// Generates the typed client from the FastAPI contract. Run `pnpm gen` at the
// repo root after changing any Pydantic schema. Output is committed (reviewable
// diffs + CI drift check); do not hand-edit src/generated.
export default defineConfig({
  input: "../../apps/api/openapi.json",
  // No formatter (the repo doesn't use prettier); generated code isn't hand-edited.
  output: "src/generated",
  // Types + SDK + a bundled fetch client. We intentionally do NOT generate the
  // TanStack Query plugin: src/queries/* wrap these SDK functions in factories
  // that add behavior (cursor de-dupe, job polling), so generated query options
  // would be unused. One query pattern, not two.
  plugins: [
    { name: "@hey-api/client-fetch", throwOnError: true },
    "@hey-api/typescript",
    "@hey-api/sdk",
  ],
});
