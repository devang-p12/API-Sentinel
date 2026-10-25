import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DemoPlaygroundProps {
  onRefreshTelemetry: () => void;
}

export function DemoPlayground({ onRefreshTelemetry }: DemoPlaygroundProps) {
  const [responseLog, setResponseLog] = useState<{
    endpoint: string;
    status: number;
    latencyMs: number;
    body: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testEndpoint = async (endpoint: string) => {
    setIsLoading(true);
    const start = performance.now();
    try {
      const res = await fetch(`http://localhost:4000${endpoint}`);
      const duration = Math.round(performance.now() - start);
      const text = await res.text();
      setResponseLog({
        endpoint,
        status: res.status,
        latencyMs: duration,
        body: text,
      });
      // Refresh Sentinel telemetry in 1 second to observe worker persistence
      setTimeout(onRefreshTelemetry, 1500);
    } catch (err: any) {
      setResponseLog({
        endpoint,
        status: 0,
        latencyMs: Math.round(performance.now() - start),
        body: `Connection failed: ${err.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card/40">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <CardTitle className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Target API Playground (localhost:4000)
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono border-border">
            Interactive Testbed
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Trigger endpoints on the controlled demo API to observe agentless background workers, timeouts, and schema drift in real time.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3.5 pt-1 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="xs"
            disabled={isLoading}
            onClick={() => testEndpoint('/healthy')}
            className="h-7 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 gap-1.5"
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            GET /healthy (200 OK)
          </Button>

          <Button
            variant="outline"
            size="xs"
            disabled={isLoading}
            onClick={() => testEndpoint('/slow?delay=1200')}
            className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 gap-1.5"
          >
            <span className="size-1.5 rounded-full bg-amber-500" />
            GET /slow (1.2s delay)
          </Button>

          <Button
            variant="outline"
            size="xs"
            disabled={isLoading}
            onClick={() => testEndpoint('/error')}
            className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <span className="size-1.5 rounded-full bg-destructive" />
            GET /error (500 Error)
          </Button>

          <Button
            variant="outline"
            size="xs"
            disabled={isLoading}
            onClick={() => testEndpoint('/schema-change')}
            className="h-7 text-xs border-sky-500/30 text-sky-500 hover:bg-sky-500/10 gap-1.5"
          >
            <span className="size-1.5 rounded-full bg-sky-500" />
            GET /schema-change (JSON)
          </Button>
        </div>

        {responseLog && (
          <div className="bg-background/80 border border-border rounded p-2.5 font-mono text-[11px] space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] border-b border-border/50 pb-1">
              <span>Direct Response from {responseLog.endpoint}</span>
              <span>Latency: {responseLog.latencyMs}ms | Status: {responseLog.status}</span>
            </div>
            <pre className="text-foreground overflow-x-auto whitespace-pre-wrap pt-0.5">
              {responseLog.body}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
