import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity, BarChart3, BellRing, ChevronLeft, ChevronRight,
  FileSearch, FlaskConical, GitCompare, Globe, Layers,
  LayoutDashboard, Settings, Terminal, Zap,
} from 'lucide-react';

interface NavItem { label: string; to: string; icon: React.ReactNode }
interface NavGroup { group: string; icon: React.ReactNode; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    group: 'Monitoring', icon: <Activity className="h-3 w-3" />,
    items: [
      { label: 'Dashboard', to: '/monitoring/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: 'APIs', to: '/monitoring/apis', icon: <Globe className="h-4 w-4" /> },
    ],
  },
  {
    group: 'Testing', icon: <FlaskConical className="h-3 w-3" />,
    items: [
      { label: 'On-Demand Test', to: '/testing/on-demand', icon: <Zap className="h-4 w-4" /> },
      { label: 'Load Testing', to: '/testing/load-tests', icon: <Layers className="h-4 w-4" /> },
      { label: 'Schema Changes', to: '/testing/schema-changes', icon: <FileSearch className="h-4 w-4" /> },
    ],
  },
  {
    group: 'Insights', icon: <BarChart3 className="h-3 w-3" />,
    items: [
      { label: 'Env Comparison', to: '/insights/comparison', icon: <GitCompare className="h-4 w-4" /> },
      { label: 'Alerts', to: '/insights/alerts', icon: <BellRing className="h-4 w-4" /> },
      { label: 'Analytics', to: '/insights/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    group: 'Admin', icon: <Settings className="h-3 w-3" />,
    items: [{ label: 'Settings', to: '/admin/settings', icon: <Settings className="h-4 w-4" /> }],
  },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isGroupActive = (g: NavGroup) => g.items.some(i => location.pathname.startsWith(i.to));

  return (
    <aside className={`h-full shrink-0 flex flex-col bg-card border-r transition-all duration-300 ${collapsed ? 'w-14' : 'w-56'}`}>
      {/* Logo */}
      <div className={`flex items-center gap-2.5 border-b p-4 ${collapsed ? 'justify-center px-3' : ''}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
          <Terminal className="h-3.5 w-3.5 text-background" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none overflow-hidden">
            <span className="truncate text-sm font-semibold tracking-tight">API Sentinel</span>
            <span className="truncate text-[10px] text-muted-foreground">Platform v2</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV.map((group) => (
          <div key={group.group}>
            {!collapsed ? (
              <div className="flex items-center gap-1.5 px-2 py-2 mt-3 first:mt-1">
                <span className="text-muted-foreground">{group.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.group}
                </span>
              </div>
            ) : isGroupActive(group) ? (
              <div className="my-1 h-px bg-border" />
            ) : null}

            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  } ${collapsed ? 'justify-center' : ''}`
                }
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-2 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">All systems operational</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors cursor-pointer ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>
          )}
        </button>
      </div>
    </aside>
  );
};
