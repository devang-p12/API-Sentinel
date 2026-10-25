import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NavbarProps {
  onRefresh: () => void;
  onOpenCreate: () => void;
  activeIncidentsCount: number;
}

export function Navbar({ onRefresh, onOpenCreate, activeIncidentsCount }: NavbarProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Default to dark mode for developer / observability aesthetic
    document.documentElement.classList.add('dark');
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40 px-4 h-13 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Logo Icon */}
          <div className="size-7 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs tracking-wider shadow-sm">
            AS
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-sm tracking-tight text-foreground">
                API Sentinel
              </span>
              <Badge variant="outline" className="text-[10px] h-4.5 px-1 py-0 font-mono text-muted-foreground border-border">
                v1.0
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground -mt-0.5">
              Observability & Reliability Platform
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-border mx-2 hidden sm:block" />

        <div className="hidden sm:flex items-center gap-2">
          <Badge variant="secondary" className="text-xs h-5.5 font-normal text-muted-foreground">
            Acme Corp
          </Badge>
          {activeIncidentsCount > 0 ? (
            <Badge variant="destructive" className="text-xs h-5.5 gap-1.5 animate-pulse">
              <span className="size-1.5 rounded-full bg-white inline-block" />
              {activeIncidentsCount} Active Incident{activeIncidentsCount > 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs h-5.5 gap-1.5 border-emerald-500/30 text-emerald-500 dark:text-emerald-400 bg-emerald-500/10">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
              All Systems Operational
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} title="Refresh Telemetry">
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          <span className="hidden md:inline">Refresh</span>
        </Button>

        <Button variant="outline" size="sm" onClick={toggleTheme} title="Toggle Theme">
          {isDark ? (
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </Button>

        <Button size="sm" onClick={onOpenCreate} className="gap-1.5 shadow-sm">
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Register Monitor</span>
        </Button>
      </div>
    </header>
  );
}
