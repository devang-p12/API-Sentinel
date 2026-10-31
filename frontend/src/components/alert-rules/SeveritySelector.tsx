import type { AlertSeverity } from '@/lib/api';

interface SeveritySelectorProps {
  value: AlertSeverity;
  onChange: (severity: AlertSeverity) => void;
}

const SEVERITIES: Array<{
  value: AlertSeverity;
  label: string;
  description: string;
  borderClass: string;
  textClass: string;
  bgSelected: string;
}> = [
  {
    value: 'INFO',
    label: 'Info',
    description: 'Informational status updates',
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    bgSelected: 'bg-muted/80 text-foreground border-foreground/30',
  },
  {
    value: 'WARNING',
    label: 'Warning',
    description: 'Non-critical performance or threshold dips',
    borderClass: 'border-amber-500/30',
    textClass: 'text-amber-500',
    bgSelected: 'bg-amber-500/10 text-amber-500 border-amber-500/40',
  },
  {
    value: 'HIGH',
    label: 'High',
    description: 'Substantial operational degradation',
    borderClass: 'border-orange-500/30',
    textClass: 'text-orange-500',
    bgSelected: 'bg-orange-500/10 text-orange-500 border-orange-500/40',
  },
  {
    value: 'CRITICAL',
    label: 'Critical',
    description: 'Service outage or complete SLA breach',
    borderClass: 'border-destructive/30',
    textClass: 'text-destructive',
    bgSelected: 'bg-destructive/10 text-destructive border-destructive/40',
  },
];

export function SeveritySelector({ value, onChange }: SeveritySelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-foreground block">Severity</label>
      <p className="text-xs text-muted-foreground mb-2">
        Determines the alert urgency and downstream incident escalation priority.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SEVERITIES.map((sev) => {
          const isSelected = sev.value === value;
          return (
            <button
              key={sev.value}
              type="button"
              onClick={() => onChange(sev.value)}
              className={`p-2.5 rounded-md border text-left transition-all text-xs flex flex-col justify-between ${
                isSelected
                  ? `${sev.bgSelected} font-medium ring-1 ring-ring`
                  : 'bg-card border-border hover:bg-muted/40 text-foreground'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className={`font-semibold ${isSelected ? '' : sev.textClass}`}>
                  {sev.label}
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    sev.value === 'CRITICAL'
                      ? 'bg-destructive'
                      : sev.value === 'HIGH'
                        ? 'bg-orange-500'
                        : sev.value === 'WARNING'
                          ? 'bg-amber-500'
                          : 'bg-muted-foreground'
                  }`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground line-clamp-1">
                {sev.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
