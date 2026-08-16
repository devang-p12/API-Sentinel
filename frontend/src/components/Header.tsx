import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, ChevronRight, Globe, Moon, Search, Sun,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useApi } from '../context/ApiContext';

const LABELS: Record<string, string> = {
  monitoring: 'Monitoring', testing: 'Testing', insights: 'Insights', admin: 'Admin',
  dashboard: 'Dashboard', apis: 'APIs', 'on-demand': 'On-Demand Test',
  'load-tests': 'Load Testing', 'schema-changes': 'Schema Changes',
  comparison: 'Env Comparison', alerts: 'Alerts', analytics: 'Analytics', settings: 'Settings',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const { theme, toggleTheme, apis } = useApi();
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState('');

  const inactiveApis = apis.filter(a => a.status === 'Inactive');
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6 transition-colors">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/monitoring/dashboard" className="hover:text-foreground transition-colors font-medium">
          Console
        </Link>
        {segments.map((seg, idx) => {
          const label = LABELS[seg] ?? seg;
          const isLast = idx === segments.length - 1;
          const path = '/' + segments.slice(0, idx + 1).join('/');
          return (
            <React.Fragment key={seg}>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              {isLast
                ? <span className="font-semibold text-foreground">{label}</span>
                : <Link to={path} className="hover:text-foreground transition-colors">{label}</Link>
              }
            </React.Fragment>
          );
        })}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search APIs..."
            className="h-8 w-52 rounded-md border bg-muted/30 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
        </div>

        {/* Theme */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <div className="relative">
          <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => setNotifOpen(p => !p)}>
            <Bell className="h-4 w-4" />
            {inactiveApis.length > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-background" />
            )}
          </Button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover shadow-lg z-50">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notifications</span>
                {inactiveApis.length > 0 && (
                  <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600 text-[10px]">
                    {inactiveApis.length} alerts
                  </Badge>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {inactiveApis.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium">All systems healthy</span>
                  </div>
                ) : inactiveApis.map(api => (
                  <div key={api.id} className="flex items-start gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/30 transition-colors">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{api.name}</p>
                      <p className="text-xs text-muted-foreground">{api.baseUrl}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border hidden md:block" />

        {/* Status */}
        <div className="hidden lg:flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs text-muted-foreground">
            Status: <span className="font-semibold text-emerald-600 dark:text-emerald-400">Online</span>
          </span>
        </div>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>DP</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem className="cursor-pointer">Profile</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">API Keys</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
