"use client";

import { usePathname } from "next/navigation";

import { getTool } from "@/features/registry";

/**
 * The app-bar title. Derives the current tool's display name from the route
 * (`/dashboard/tools/<slug>`) via the registry — the same source of truth that
 * drives the sidebar — so it can never drift from a tool's `meta`. Falls back to
 * the product name on the dashboard home and any non-tool route.
 */
export function HeaderTitle() {
  const pathname = usePathname();
  const slug = pathname.match(/^\/dashboard\/tools\/([^/]+)/)?.[1];
  const name = (slug && getTool(slug)?.name) || "Instagram Tools";

  return <span className="text-sm font-medium">{name}</span>;
}
