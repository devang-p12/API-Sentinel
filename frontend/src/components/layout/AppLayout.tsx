import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Sheet, SheetContent } from "@/components/ui/sheet"

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Navigation */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r border-border bg-sidebar">
          <Sidebar onItemClick={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Right Column: Header + Main Scrollable Content */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto min-h-0 bg-background/50 focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
