import { Card, CardContent } from '@/components/ui/card';
import type { Monitor, Incident } from '@/lib/api';

interface MetricsOverviewProps {
  monitors: Monitor[];
  incidents: Incident[];
}

export function MetricsOverview({ monitors, incidents }: MetricsOverviewProps) {
  const totalMonitors = monitors.length;
  const activeMonitors = monitors.filter((m) => m.isActive).length;

  // Compute overall status from latest runs
  let totalSuccessfulRuns = 0;
  let totalRunsCount = 0;
  let sumLatency = 0;
  let latencyRunsCount = 0;

  for (const m of monitors) {
    if (m.executions && m.executions.length > 0) {
      const latest = m.executions[0];
      totalRunsCount++;
      if (latest.status === 'SUCCESS') totalSuccessfulRuns++;
      if (latest.responseTimeMs !== null && latest.responseTimeMs !== undefined) {
        sumLatency += latest.responseTimeMs;
        latencyRunsCount++;
      }
    }
  }

  const overallAvailability =
    totalRunsCount > 0 ? ((totalSuccessfulRuns / totalRunsCount) * 100).toFixed(1) : '100.0';

  const avgLatency =
    latencyRunsCount > 0 ? Math.round(sumLatency / latencyRunsCount) : 0;

  const activeIncidents = incidents.filter(
    (inc) => inc.status === 'OPEN' || inc.status === 'TRIGGERED' || inc.status === 'ACKNOWLEDGED',
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Card 1: Total Monitors */}
      <Card className="border-border bg-card/50 shadow-none">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Monitored Endpoints</span>
            <svg className="size-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-heading tracking-tight text-foreground">
              {totalMonitors}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {activeMonitors} active
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Overall Uptime SLA */}
      <Card className="border-border bg-card/50 shadow-none">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Current Availability</span>
            <svg className="size-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-heading tracking-tight ${
                parseFloat(overallAvailability) >= 99.0
                  ? 'text-emerald-500'
                  : parseFloat(overallAvailability) >= 90.0
                  ? 'text-amber-500'
                  : 'text-destructive'
              }`}
            >
              {overallAvailability}%
            </span>
            <span className="text-[11px] text-muted-foreground">across endpoints</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Avg Response Time */}
      <Card className="border-border bg-card/50 shadow-none">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Average Latency</span>
            <svg className="size-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-heading tracking-tight text-foreground">
              {avgLatency}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">ms</span>
            </span>
            <span className="text-[11px] text-muted-foreground">live median</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Active Incidents */}
      <Card
        className={`border-border shadow-none ${
          activeIncidents.length > 0 ? 'bg-destructive/10 border-destructive/30' : 'bg-card/50'
        }`}
      >
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Active Incidents</span>
            <svg
              className={`size-4 ${activeIncidents.length > 0 ? 'text-destructive' : 'opacity-70'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-heading tracking-tight ${
                activeIncidents.length > 0 ? 'text-destructive font-mono' : 'text-foreground'
              }`}
            >
              {activeIncidents.length}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {activeIncidents.length === 0 ? 'no active outages' : 'requires attention'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
