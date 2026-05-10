"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Settings,
  Sun,
  Moon,
  LogOut,
  LayoutDashboard,
  GitPullRequest,
  MessageSquare,
  MessageCircle,
  FileText,
  type LucideIcon
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import Logout from "@/module/auth/components/logout";
import { cn } from "@/lib/utils";

// Custom GitHub icon to replace missing Lucide icon
const GithubIcon = ({ className = "" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4" />
  </svg>
);

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar } from "@/components/retroui/Avatar";
import { Button } from "@/components/retroui/Button";

// Centralizing types makes the code extensible and predictable
type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Repositories",
    url: "/dashboard/repositories",
    icon: BookOpen,
  },
  {
    title: "Pull Requests",
    url: "/dashboard/pull-requests",
    icon: GitPullRequest,
  },
  {
    title: "Reviews",
    url: "/dashboard/reviews",
    icon: MessageSquare,
  },
  {
    title: "Chat",
    url: "/dashboard/chat",
    icon: MessageCircle,
  },
  {
    title: "Rules",
    url: "/dashboard/rules",
    icon: FileText,
  },
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: Settings,
  },
];

// Utility functions should live outside the component render cycle
const getUserInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

export const AppSidebar = () => {
  const [mounted, setMounted] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      // Sync the theme toggle button's icon to the actual hydrated HTML class.
      setIsDarkTheme(document.documentElement.classList.contains("dark"));
    });
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDarkTheme(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkTheme(true);
    }
  };

  const isActive = (url: string) => {
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  // Prevent hydration mismatch while keeping sidebar layout stable.
  if (!mounted) {
    return (
      <Sidebar className="border-r-4 border-black dark:border-white bg-[#fdfaf2] dark:bg-zinc-950 font-sans shadow-[4px_0px_0_0_#000] dark:shadow-[4px_0px_0_0_#fff]">
        <div className="flex items-center justify-center h-full">
          <span className="animate-spin text-2xl">⏳</span>
        </div>
      </Sidebar>
    );
  }

  const user = session?.user;
  const userName = user?.name || "GUEST";
  const userEmail = user?.email || "";
  const userInitials = getUserInitials(userName);

  // Dynamic icon processing for Theme toggle
  const ThemeIcon = isDarkTheme ? Moon : Sun;

  return (
    <Sidebar className="border-r-4 border-black dark:border-white bg-[#fdfaf2] dark:bg-zinc-950 font-sans transition-colors overflow-visible">
      <SidebarHeader className="border-b-4 border-black dark:border-white p-0 bg-[#f7d6a7] dark:bg-zinc-900 transition-colors">
        <div className="flex flex-col gap-4 p-4 group-data-[collapsible=icon]:p-2">
          <div className="flex items-center gap-4 px-3 py-4 rounded-xl border-4 border-black dark:border-white bg-white dark:bg-zinc-800 shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] transition-all group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:shadow-none dark:group-data-[collapsible=icon]:shadow-none">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#ffdb33] border-2 border-black dark:border-zinc-900 text-black shrink-0 transition-all group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
              <GithubIcon className="w-8 h-8 stroke-[2.5] group-data-[collapsible=icon]:w-5 group-data-[collapsible=icon]:h-5" />
            </div>

            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-[11px] font-black text-black/70 dark:text-white/70 tracking-widest uppercase">
                Connected
              </p>
              <p className="text-base font-bold text-black dark:text-white truncate">
                @{userName}
              </p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-6 bg-[#fdfaf2] dark:bg-zinc-950 transition-colors gap-4 group-data-[collapsible=icon]:px-2">
        <SidebarMenu className="gap-4">
          {navigationItems.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={cn(
                    // Base styles
                    "h-14 px-4 rounded-xl border-4 border-black dark:border-white font-bold uppercase transition-all duration-200",
                    // Active click states
                    "active:translate-y-1 active:translate-x-1 active:shadow-none dark:active:shadow-none",
                    // Collapsed specific overrides
                    "group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:shadow-none dark:group-data-[collapsible=icon]:shadow-none",
                    "group-data-[collapsible=icon]:active:translate-y-0 group-data-[collapsible=icon]:active:translate-x-0",
                    // Conditional Active highlighting matching your Retro theme aesthetics
                    active
                      ? "bg-[#ffdb33] text-black shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]"
                      : "bg-white dark:bg-zinc-800 text-black dark:text-white hover:bg-[#fae583] dark:hover:bg-[#fae583] dark:hover:text-black hover:shadow-[4px_4px_0_0_#000] dark:hover:shadow-[4px_4px_0_0_#fff]"
                  )}
                >
                  <Link href={item.url} className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center">
                    <item.icon className="w-5 h-5 shrink-0 stroke-[2.5]" />
                    <span className="text-sm tracking-wide group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarSeparator className="h-1 bg-black dark:bg-white w-full" />

      <SidebarFooter className="p-4 bg-[#fdfaf2] dark:bg-zinc-950 transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:items-center">
        <div className="flex items-center gap-3 mb-4 p-3 border-4 border-black dark:border-white bg-white dark:bg-zinc-800 rounded-xl shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none dark:group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent">
          <Avatar className="h-10 w-10 border-4 border-black dark:border-white transition-all group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
            <Avatar.Image src={user?.image || ""} />
            <Avatar.Fallback className="bg-[#ffdb33] text-black font-black">
              {userInitials}
            </Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-black dark:text-white truncate">
              {userName}
            </span>
            <span className="text-[10px] uppercase font-bold text-black/60 dark:text-white/60 truncate tracking-wide">
              {userEmail}
            </span>
          </div>
        </div>

        <div className="flex gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <Button
            onClick={toggleTheme}
            className={cn(
                // Base
                "flex-1 group-data-[collapsible=icon]:flex-none bg-white dark:bg-zinc-800 hover:bg-[#ffdb33] dark:hover:bg-[#ffdb33] text-black dark:text-white dark:hover:text-black",
                // Borders & shadows
                "border-4 border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]",
                // Interactions
                "active:shadow-none dark:active:shadow-none active:translate-x-1 active:translate-y-1 rounded-xl h-12 uppercase font-black transition-all inline-flex overflow-hidden",
                // Collapsed overrides
                "group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none dark:group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:justify-center"
            )}
          >
            <ThemeIcon className="w-5 h-5 group-data-[collapsible=icon]:mr-0 mr-2 stroke-3" />
            <span className="group-data-[collapsible=icon]:hidden">Theme</span>
          </Button>

          <Logout>
            <Button
              className={cn(
                "flex items-center justify-center bg-[#ff6b6b] hover:bg-[#ff5252] text-black dark:text-zinc-900 border-4 border-black dark:border-white",
                "shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] active:shadow-none dark:active:shadow-none active:translate-x-1 active:translate-y-1",
                "rounded-xl h-12 w-12 p-0 transition-all",
                "group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:shadow-none"
              )}
            >
              <LogOut className="w-5 h-5 stroke-3 ml-1 group-data-[collapsible=icon]:ml-0" />
            </Button>
          </Logout>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
