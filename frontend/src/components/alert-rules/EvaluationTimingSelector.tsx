interface EvaluationTimingSelectorProps {
  evaluationWindow: string; // e.g. "5m", "15m", "1h"
  forDuration: number; // in seconds, e.g. 120
  evaluationInterval: number; // in seconds, e.g. 60
  onEvaluationWindowChange: (window: string) => void;
  onForDurationChange: (duration: number) => void;
  onEvaluationIntervalChange: (interval: number) => void;
}

const EVALUATION_WINDOW_OPTIONS = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '10m', label: '10 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
];

const FOR_DURATION_OPTIONS = [
  { value: 0, label: '0s (Immediate — fire on first breach)' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
];

const EVALUATION_INTERVAL_OPTIONS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute (Default)' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
];

export function EvaluationTimingSelector({
  evaluationWindow,
  forDuration,
  evaluationInterval,
  onEvaluationWindowChange,
  onForDurationChange,
  onEvaluationIntervalChange,
}: EvaluationTimingSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Evaluation Window */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">
            Evaluation Window
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Query time range over which telemetry values are aggregated.
          </p>
          <select
            value={evaluationWindow}
            onChange={(e) => onEvaluationWindowChange(e.target.value)}
            className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {EVALUATION_WINDOW_OPTIONS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        {/* For Duration */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">
            For Duration (Pending Grace Period)
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Condition must remain true for this duration before the alert fires.
          </p>
          <select
            value={forDuration}
            onChange={(e) => onForDurationChange(parseInt(e.target.value, 10))}
            className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {FOR_DURATION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Explanatory state machine banner */}
      <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between font-mono">
        <span>State Machine:</span>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-muted border border-border/60 text-foreground">
            NORMAL
          </span>
          <span>&rarr;</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500">
            PENDING ({forDuration > 0 ? `${forDuration}s` : '0s'})
          </span>
          <span>&rarr;</span>
          <span className="px-1.5 py-0.5 rounded bg-destructive/10 border border-destructive/30 text-destructive">
            FIRING
          </span>
          <span>&rarr;</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
            RESOLVED
          </span>
        </div>
      </div>

      {/* Evaluation Interval (advanced parameter) */}
      <div className="pt-2">
        <label className="text-xs font-medium text-foreground block mb-1">
          Evaluation Frequency
        </label>
        <p className="text-[11px] text-muted-foreground mb-1.5">
          How often the background scheduler evaluates this rule.
        </p>
        <div className="max-w-xs">
          <select
            value={evaluationInterval}
            onChange={(e) => onEvaluationIntervalChange(parseInt(e.target.value, 10))}
            className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {EVALUATION_INTERVAL_OPTIONS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
