import type { AlertCondition } from '@/lib/api';
import { Input } from '@/components/ui/input';

interface ConditionBuilderProps {
  metricName: string;
  metricUnit: string;
  condition: AlertCondition;
  threshold: number | string;
  onConditionChange: (condition: AlertCondition) => void;
  onThresholdChange: (threshold: number) => void;
  error?: string;
}

export const OPERATOR_OPTIONS: Array<{
  value: AlertCondition;
  label: string;
  symbol: string;
}> = [
  { value: 'GREATER_THAN', label: 'Greater than', symbol: '>' },
  { value: 'GREATER_THAN_OR_EQUAL', label: 'Greater than or equal to', symbol: '>=' },
  { value: 'LESS_THAN', label: 'Less than', symbol: '<' },
  { value: 'LESS_THAN_OR_EQUAL', label: 'Less than or equal to', symbol: '<=' },
  { value: 'EQUAL', label: 'Equal to', symbol: '==' },
  { value: 'NOT_EQUAL', label: 'Not equal to', symbol: '!=' },
];

export function ConditionBuilder({
  metricName,
  metricUnit,
  condition,
  threshold,
  onConditionChange,
  onThresholdChange,
  error,
}: ConditionBuilderProps) {
  const handleThresholdInput = (val: string) => {
    if (val === '') {
      onThresholdChange(0);
      return;
    }
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onThresholdChange(parsed);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-foreground block mb-1">
          Condition & Threshold <span className="text-destructive">*</span>
        </label>
        <p className="text-xs text-muted-foreground mb-3">
          Construct the threshold expression that indicates abnormal operational behavior.
        </p>

        {/* Visual condition builder block */}
        <div className="rounded-md border border-border/80 bg-card p-4 space-y-3">
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            Evaluation Rule
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 font-mono text-xs">
            {/* WHEN prefix */}
            <span className="text-muted-foreground font-semibold px-2 py-1 rounded bg-muted/60 border border-border/60 shrink-0">
              WHEN
            </span>

            {/* Metric pill */}
            <span className="font-semibold text-foreground px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-primary truncate max-w-[200px]">
              {metricName || 'Metric'}
            </span>

            {/* Operator select */}
            <div className="shrink-0 min-w-[200px]">
              <select
                value={condition}
                onChange={(e) => onConditionChange(e.target.value as AlertCondition)}
                className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label} ({op.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Threshold Input */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="number"
                step="any"
                value={threshold === 0 ? '0' : threshold || ''}
                onChange={(e) => handleThresholdInput(e.target.value)}
                placeholder="0"
                className="w-28 h-8 text-xs font-mono font-semibold"
              />
              <span className="text-muted-foreground px-2 py-1 rounded bg-muted/40 border border-border/40 text-[11px]">
                {metricUnit || 'unit'}
              </span>
            </div>
          </div>

          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
