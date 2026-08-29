import React from "react";
import { Outlet } from "react-router-dom";

import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center border-b bg-background px-4">
            <SidebarTrigger />

            <div className="mx-3 h-5 w-px bg-border" />

            <span className="text-sm font-medium">
              API Sentinel
            </span>
          </header>

          {/* Page Content */}
          <main className="min-h-0 flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}