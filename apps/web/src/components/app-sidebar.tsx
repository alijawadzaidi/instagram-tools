"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Camera, LogOut } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { tools, toolHref } from "@/lib/tools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  const router = useRouter();
  const { data: session } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push("/sign-in") },
    });
  }

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

      {session && (
        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-2">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name ?? ""}
                className="size-7 rounded-full object-cover"
              />
            ) : (
              <div className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                {session.user.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-medium truncate">{session.user.name}</p>
              <p className="text-muted-foreground truncate">{session.user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
