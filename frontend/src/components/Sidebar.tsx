import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  BarChart3,
  ChevronRight,
  Database,
  FlaskConical,
  GitCompare,
  LayoutDashboard,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV = [
  {
    section: 'Monitoring',
    icon: Activity,
    items: [
      { label: 'Dashboard',   to: '/monitoring/dashboard', icon: LayoutDashboard },
      { label: 'APIs',        to: '/monitoring/apis',      icon: Database },
    ],
  },
  {
    section: 'Testing',
    icon: FlaskConical,
    items: [
      { label: 'On-Demand',      to: '/testing/on-demand',     icon: Zap },
      { label: 'Load Tests',     to: '/testing/load-tests',    icon: BarChart3 },
      { label: 'Schema Changes', to: '/testing/schema-changes', icon: GitCompare },
    ],
  },
  {
    section: 'Insights',
    icon: BarChart3,
    items: [
      { label: 'Env Comparison', to: '/insights/comparison', icon: GitCompare },
      { label: 'Alerts',         to: '/insights/alerts',     icon: AlertCircle },
      { label: 'Analytics',      to: '/insights/analytics',  icon: BarChart3 },
    ],
  },
  {
    section: 'Admin',
    icon: Settings,
    items: [
      { label: 'Settings', to: '/admin/settings', icon: Settings },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
          <Shield className="h-4 w-4 text-background" />
        </div>
        <span className="text-sm font-semibold tracking-tight">API Sentinel</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {section}
            </p>
            <ul className="space-y-0.5">
              {items.map(({ label, to, icon: Icon }) => {
                const active = location.pathname === to ||
                  (to !== '/monitoring/dashboard' && location.pathname.startsWith(to));
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={[
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{label}</span>
                      {active && (
                        <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <p className="text-[10px] text-muted-foreground">
          v1.0.0 &middot; API Sentinel
        </p>
      </div>
    </aside>
  );
};