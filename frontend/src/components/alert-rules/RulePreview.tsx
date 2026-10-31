import { useMemo } from 'react';
import type { AlertCondition, AlertSeverity, MetricQueryResult, AlertRuleNotificationConfig } from '@/lib/api';
import { MetricPreviewChart } from './MetricPreviewChart';
import { Badge } from '@/components/ui/badge';
import { OPERATOR_OPTIONS } from './ConditionBuilder';

interface RulePreviewProps {
  name: string;
  description?: string;
  metricName: string;
  metricId: string;
  metricUnit: string;
  projectName: string;
  apiName: string;
  environmentName: string;
  monitorName: string;
  condition: AlertCondition;
  threshold: number;
  forDuration: number; // in seconds
  evaluationWindow: string;
  severity: AlertSeverity;
  labels: Record<string, string>;
  notificationConfig?: AlertRuleNotificationConfig;
  metricData: MetricQueryResult | null;
  isLoadingMetricData?: boolean;
  metricError?: string | null;
}

export function RulePreview({
  name,
  description,
  metricName,
  metricId,
  metricUnit,
  projectName,
  apiName,
  environmentName,
  monitorName,
  condition,
  threshold,
  forDuration,
  evaluationWindow,
  severity,
  labels,
  notificationConfig,
  metricData,
  isLoadingMetricData = false,
  metricError = null,
}: RulePreviewProps) {
  const operatorObj = useMemo(() => {
    return OPERATOR_OPTIONS.find((o) => o.value === condition) || OPERATOR_OPTIONS[0];
  }, [condition]);

  // Natural language description
  const naturalLanguageSummary = useMemo(() => {
    const scopeParts: string[] = [];
    if (apiName) scopeParts.push(apiName);
    else scopeParts.push('all APIs');

    if (environmentName) scopeParts.push(`in ${environmentName}`);
    if (monitorName) scopeParts.push(`(${monitorName})`);
    if (projectName && !apiName) scopeParts.push(`in ${projectName}`);

    const scopeStr = scopeParts.join(' ');
    const opStr = operatorObj.label.toLowerCase();
    const durationStr = forDuration > 0 ? `for at least ${Math.round(forDuration / 60)} minutes` : 'immediately';

    return `This rule will fire when the ${metricName || 'metric'} of ${scopeStr} remains ${opStr} ${threshold} ${metricUnit} ${durationStr}.`;
  }, [metricName, apiName, environmentName, monitorName, projectName, operatorObj, threshold, metricUnit, forDuration]);

  const severityBadgeClass = useMemo(() => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-destructive/15 text-destructive border-destructive/30';
      case 'HIGH':
        return 'bg-orange-500/15 text-orange-500 border-orange-500/30';
      case 'WARNING':
        return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
      case 'INFO':
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  }, [severity]);

  return (
    <div className="space-y-4 sticky top-6">
      {/* Container Card */}
      <div className="rounded-lg border border-border bg-card shadow-sm p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-0.5">
              Rule preview
            </span>
            <h3 className="text-sm font-semibold text-foreground line-clamp-1">
              {name.trim() || 'Untitled Alert Rule'}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{description}</p>
            )}
          </div>
          <Badge variant="outline" className={`shrink-0 text-[10px] font-mono uppercase ${severityBadgeClass}`}>
            {severity}
          </Badge>
        </div>

        {/* Natural Language Summary Card */}
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
          <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold block mb-1">
            Summary
          </span>
          <p>{naturalLanguageSummary}</p>
        </div>

        {/* Technical Specification Breakdown */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Technical Specification
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Metric</span>
              <span className="font-semibold text-foreground">{metricId || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Scope</span>
              <span className="font-semibold text-foreground truncate max-w-[200px]">
                {apiName ? `api=${apiName}` : 'all_apis'}
                {environmentName ? `, env=${environmentName}` : ''}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Condition</span>
              <span className="font-semibold text-foreground">
                {metricId || 'metric'} {operatorObj.symbol} {threshold} {metricUnit}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Window</span>
              <span className="font-semibold text-foreground">{evaluationWindow}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">For Duration</span>
              <span className="font-semibold text-foreground">
                {forDuration > 0 ? `${Math.round(forDuration / 60)}m (${forDuration}s)` : '0s (Immediate)'}
              </span>
            </div>
            {Object.keys(labels).length > 0 && (
              <div className="pt-1">
                <span className="text-muted-foreground block mb-1">Labels:</span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(labels).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-1.5 py-0.2 rounded bg-muted border border-border/60 text-[10px] text-foreground"
                    >
                      {k}={v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notification Configuration Summary Preview */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Notification
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Delivery</span>
              <span className="font-semibold text-foreground">Email</span>
            </div>
            <div className="py-0.5 border-b border-border/40 space-y-0.5">
              <span className="text-muted-foreground block">To:</span>
              {notificationConfig?.email?.recipients && notificationConfig.email.recipients.length > 0 ? (
                <div className="space-y-0.5 pl-1">
                  {notificationConfig.email.recipients.map((r, i) => (
                    <div key={i} className="font-semibold text-foreground truncate">
                      {r}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground italic pl-1">No recipients configured</span>
              )}
            </div>
            <div className="py-0.5 space-y-0.5">
              <span className="text-muted-foreground block">Events:</span>
              <div className="space-y-0.5 pl-1 text-[10px]">
                {notificationConfig?.email?.onFiring !== false && (
                  <div className="text-foreground">Alert firing</div>
                )}
                {notificationConfig?.email?.onResolved !== false && (
                  <div className="text-foreground">Alert resolved</div>
                )}
                {notificationConfig?.email?.onFiring === false && notificationConfig?.email?.onResolved === false && (
                  <div className="text-muted-foreground italic">No events selected</div>
                )}
              </div>
            </div>
            {(notificationConfig?.email?.repeatInterval || 0) > 0 && (
              <div className="flex justify-between items-center pt-0.5 border-t border-border/40 text-[10px]">
                <span className="text-muted-foreground">Repeat:</span>
                <span className="text-foreground">Every {notificationConfig?.email?.repeatInterval}m</span>
              </div>
            )}
          </div>
        </div>

        {/* Real Historical Telemetry Preview Chart */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            <span>Historical Telemetry Preview</span>
            <span>{evaluationWindow} window</span>
          </div>
          <MetricPreviewChart
            data={metricData}
            threshold={threshold}
            unit={metricUnit}
            metricName={metricName}
            isLoading={isLoadingMetricData}
            error={metricError}
            height={150}
          />
        </div>
      </div>
    </div>
  );
}
