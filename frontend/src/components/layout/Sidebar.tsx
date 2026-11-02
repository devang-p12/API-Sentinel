import { useState } from "react"
import { NavLink } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  ApiIcon,
  Activity01Icon,
  AlertCircleIcon,
  Notification01Icon,
  Settings01Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  FlashIcon,
  PlayIcon,
  FileCodeIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { ResizeHandle } from "@/components/common/ResizeHandle"

interface NavItem {
  name: string
  to: string
  icon: any
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { name: "Overview", to: "/dashboard", icon: DashboardSquare01Icon },
  { name: "APIs", to: "/apis", icon: ApiIcon },
  { name: "API Tester", to: "/api-tester", icon: PlayIcon },
  { name: "Monitors", to: "/monitors", icon: Activity01Icon },
  { name: "Contracts & Schema", to: "/contracts", icon: FileCodeIcon },
  { name: "Load Tests", to: "/load-tests", icon: FlashIcon },
  { name: "Incidents", to: "/incidents", icon: AlertCircleIcon },
  { name: "Alert Rules", to: "/alert-rules", icon: Notification01Icon },
  { name: "Dashboards", to: "/dashboards", icon: DashboardSquare01Icon },
  { name: "Settings", to: "/settings", icon: Settings01Icon },
]

interface SidebarProps {
  onItemClick?: () => void
}

export function Sidebar({ onItemClick }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sentinel_sidebar_collapsed") === "true"
    } catch {
      return false
    }
  })

  const [width, setWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("sentinel_sidebar_width")
      return stored ? parseInt(stored, 10) : 256
    } catch {
      return 256
    }
  })

  const handleToggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    try {
      localStorage.setItem("sentinel_sidebar_collapsed", String(next))
    } catch {}
  }

  const handleResize = (delta: number) => {
    if (isCollapsed) return
    setWidth((prev) => {
      const next = Math.min(380, Math.max(200, prev + delta))
      return next
    })
  };

  const handleResizeEnd = () => {
    try {
      localStorage.setItem("sentinel_sidebar_width", String(width))
    } catch {}
  }

  const effectiveWidth = isCollapsed ? 64 : width

  return (
    <TooltipProvider delay={100}>
      <aside
        style={{ width: `${effectiveWidth}px` }}
        className="relative border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-full shrink-0 select-none transition-[width] duration-150 ease-out"
      >
        {/* Brand Header */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-7 rounded bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold text-xs tracking-wider shadow-sm shrink-0">
              AS
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-semibold text-sm tracking-tight text-sidebar-foreground truncate">
                    API Sentinel
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1 py-0 font-mono text-muted-foreground border-sidebar-border shrink-0"
                  >
                    v1.0
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground -mt-0.5 truncate">
                  Observability Platform
                </span>
              </div>
            )}
          </div>

          {/* Collapse/Expand Toggle Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="size-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
          >
            <HugeiconsIcon
              icon={isCollapsed ? SidebarRight01Icon : SidebarLeft01Icon}
              className="size-4"
            />
          </Button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-3 px-2 overflow-y-auto space-y-1 overflow-x-hidden">
          {!isCollapsed && (
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Platform
            </div>
          )}
          <nav className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const navLink = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onItemClick}
                  end={item.to === "/dashboard"}
                  className={({ isActive }) =>
                    `flex items-center ${
                      isCollapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2"
                    } text-xs font-medium rounded-none transition-colors border-l-2 ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-primary shadow-xs"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent"
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <HugeiconsIcon icon={item.icon} className="size-4 shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </div>
                  {!isCollapsed && item.badge && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1.5 font-mono shrink-0"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </NavLink>
              )

              if (isCollapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger render={navLink} />
                    <TooltipContent side="right" className="font-mono text-xs">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return navLink
            })}
          </nav>
        </div>

        {/* Footer / Tenant Context */}
        <div className="p-2.5 border-t border-sidebar-border bg-sidebar/50 shrink-0">
          {!isCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                <span>Organization</span>
                <span className="font-medium text-sidebar-foreground truncate max-w-[120px]">
                  Acme Corp
                </span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px]">
                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span className="font-medium truncate">System Operational</span>
              </div>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <div className="flex justify-center py-1">
                    <span
                      aria-label="System Operational"
                      className="size-2 rounded-full bg-emerald-500 animate-pulse"
                    />
                  </div>
                }
              />
              <TooltipContent side="right" className="font-mono text-xs">
                Acme Corp: Operational
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Right edge drag resize handle */}
        {!isCollapsed && (
          <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center">
            <ResizeHandle
              direction="horizontal"
              onResize={handleResize}
              onResizeEnd={handleResizeEnd}
              title="Drag to resize sidebar width"
              className="h-full"
            />
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}
