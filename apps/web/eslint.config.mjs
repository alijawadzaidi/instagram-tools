import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

// Tool feature slugs under src/features/. Each gets a zone forbidding it from
// importing any *other* feature (no cross-feature coupling) — keep in sync with
// src/features/registry.ts.
const FEATURES = [
  "transcribe",
  "profile",
  "hashtags",
  "overview",
  "cover",
  "ranking",
  "export",
];

// Architecture boundaries (Architecture/04). Import direction is one-way:
//   components/ui  ->  (nothing domain-specific)
//   lib, hooks, queries, components, providers  ->  may use ui; never features/app
//   features/<a>   ->  shared layers only; never features/<b>, never app
//   app/           ->  the only consumer of features
const SHARED_LAYERS = [
  "./src/lib",
  "./src/hooks",
  "./src/queries",
  "./src/components",
  "./src/providers",
];

const importZones = [
  // Shared layers must not depend on individual features, but MAY read the
  // registry manifest (features/registry.ts) — that's how app-chrome (sidebar,
  // home grid) renders the tool list without coupling to any one feature.
  ...SHARED_LAYERS.map((target) => ({
    target,
    from: "./src/features",
    except: ["./registry.ts"],
    message:
      "Shared layers may import features/registry.ts (the manifest) but not individual features.",
  })),
  // Shared layers must not depend on the app/ (route) layer at all.
  ...SHARED_LAYERS.map((target) => ({
    target,
    from: "./src/app",
    message: "Shared layers (lib/hooks/queries/components/providers) must not import from app/.",
  })),
  // A feature must not import another feature — share via the layers above.
  ...FEATURES.map((slug) => ({
    target: `./src/features/${slug}`,
    from: "./src/features",
    except: [`./${slug}`],
    message: "Features must not import other features; lift shared code into src/.",
  })),
  // Features must not reach into the route layer.
  {
    target: "./src/features",
    from: "./src/app",
    message: "Features must not import from app/ (routes consume features, not the reverse).",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": ["error", { zones: importZones }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
