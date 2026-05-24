"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera } from "lucide-react";

import { tools, toolHref } from "@/lib/tools";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Instagram Tools" render={<Link href="/" />}>
              <div className="bg-gradient-to-tr from-fuchsia-500 to-amber-400 text-white flex aspect-square size-8 items-center justify-center rounded-lg">
                <Camera className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Instagram Tools</span>
                <span className="truncate text-xs text-muted-foreground">
                  Social toolset
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarMenu>
            {tools.map((tool) => {
              const href = toolHref(tool.slug);
              const isActive = pathname === href;
              const isSoon = tool.status === "soon";
              return (
                <SidebarMenuItem key={tool.slug}>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={tool.name}
                    aria-disabled={isSoon}
                    className={isSoon ? "opacity-60 pointer-events-none" : undefined}
                    render={isSoon ? <span /> : <Link href={href} />}
                  >
                    <tool.icon />
                    <span>{tool.name}</span>
                    {isSoon && (
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        Soon
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
