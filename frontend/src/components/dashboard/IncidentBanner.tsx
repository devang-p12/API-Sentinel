import type { Incident } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface IncidentBannerProps {
  incidents: Incident[];
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
}

export function IncidentBanner({ incidents, onAcknowledge, onResolve }: IncidentBannerProps) {
  const activeIncidents = incidents.filter(
    (i) => i.status === 'TRIGGERED' || i.status === 'ACKNOWLEDGED',
  );

  if (activeIncidents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {activeIncidents.map((incident) => {
        const isAcked = incident.status === 'ACKNOWLEDGED';
        return (
          <Alert
            key={incident.id}
            variant="destructive"
            className="border-destructive/40 bg-destructive/10 text-foreground flex flex-col md:flex-row md:items-center justify-between gap-3 p-3"
          >
            <div className="flex items-start gap-2.5">
              <svg className="size-4 text-destructive shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <div className="flex items-center gap-2">
                  <AlertTitle className="text-xs font-semibold text-destructive uppercase tracking-wide">
                    {incident.alert?.name || 'Service Degradation Alert'}
                  </AlertTitle>
                  <Badge variant="outline" className={`text-[10px] h-4.5 font-mono ${isAcked ? 'border-amber-500/40 text-amber-500' : 'border-destructive text-destructive'}`}>
                    {incident.status}
                  </Badge>
                </div>
                <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                  {incident.summary}
                </AlertDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              {!isAcked && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onAcknowledge(incident.id)}
                  className="h-6 text-xs border-destructive/30 hover:bg-destructive/20"
                >
                  Acknowledge
                </Button>
              )}
              <Button
                variant="secondary"
                size="xs"
                onClick={() => onResolve(incident.id)}
                className="h-6 text-xs"
              >
                Resolve
              </Button>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
