import { NavLink } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  ApiIcon,
  Activity01Icon,
  AlertCircleIcon,
  Notification01Icon,
  ChartLineData01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"

interface NavItem {
  name: string
  to: string
  icon: any
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { name: "Overview", to: "/dashboard", icon: DashboardSquare01Icon },
  { name: "APIs", to: "/apis", icon: ApiIcon },
  { name: "Monitors", to: "/monitors", icon: Activity01Icon },
  { name: "Incidents", to: "/incidents", icon: AlertCircleIcon },
  { name: "Alerts", to: "/alerts", icon: Notification01Icon },
  { name: "Dashboards", to: "/dashboards", icon: ChartLineData01Icon },
  { name: "Settings", to: "/settings", icon: Settings01Icon },
]

interface SidebarProps {
  onItemClick?: () => void
}

export function Sidebar({ onItemClick }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="size-7 rounded bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold text-xs tracking-wider shadow-sm">
          AS
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-heading font-semibold text-sm tracking-tight text-sidebar-foreground">
              API Sentinel
            </span>
            <Badge
              variant="outline"
              className="text-[10px] h-4.5 px-1 py-0 font-mono text-muted-foreground border-sidebar-border"
            >
              v1.0
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground -mt-0.5">
            Observability Platform
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-3 px-2 overflow-y-auto space-y-1">
        <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Platform
        </div>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onItemClick}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 px-3 py-2 text-xs font-medium rounded-none transition-colors border-l-2 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-primary shadow-xs"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent"
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <HugeiconsIcon icon={item.icon} className="size-4 shrink-0" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-4 px-1.5 font-mono"
                >
                  {item.badge}
                </Badge>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer / Tenant Context */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar/50 space-y-2">
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span>Organization</span>
          <span className="font-medium text-sidebar-foreground">Acme Corp</span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px]">
          <span className="size-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <span className="font-medium truncate">System Operational</span>
        </div>
      </div>
    </aside>
  )
}
