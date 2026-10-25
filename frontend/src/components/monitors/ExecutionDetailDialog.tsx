import type { MonitorExecution } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ExecutionDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  execution: MonitorExecution | null
  monitorName?: string
}

export function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "SUCCESS":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    case "FAILED":
      return "bg-destructive/10 text-destructive border-destructive/20"
    case "TIMEOUT":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20"
    case "ERROR":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

export function ExecutionDetailDialog({
  open,
  onOpenChange,
  execution,
  monitorName,
}: ExecutionDetailDialogProps) {
  if (!execution) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold">
                Execution Telemetry
              </DialogTitle>
              <Badge
                variant="outline"
                className={`font-mono text-[10px] font-bold ${getStatusBadgeVariant(
                  execution.status
                )}`}
              >
                {execution.status}
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-xs font-mono">
            ID: {execution.id} {monitorName ? `• ${monitorName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1 text-xs">
          {/* Status Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-muted/40 border border-border space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                Status
              </span>
              <span className="font-semibold text-foreground">{execution.status}</span>
            </div>

            <div className="p-2.5 bg-muted/40 border border-border space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                HTTP Status
              </span>
              <span className="font-semibold text-foreground font-mono">
                {execution.statusCode !== null ? execution.statusCode : "—"}
              </span>
            </div>

            <div className="p-2.5 bg-muted/40 border border-border space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                Duration
              </span>
              <span className="font-semibold text-foreground font-mono">
                {execution.durationMs ?? execution.responseTimeMs} ms
              </span>
            </div>

            <div className="p-2.5 bg-muted/40 border border-border space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                Response Size
              </span>
              <span className="font-semibold text-foreground font-mono">
                {execution.responseSize !== null ? `${execution.responseSize} B` : "—"}
              </span>
            </div>
          </div>

          {/* Timing details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 bg-muted/20 border border-border text-muted-foreground">
              <span className="text-foreground font-medium">Started At: </span>
              {execution.startedAt ? new Date(execution.startedAt).toLocaleString() : new Date(execution.executedAt).toLocaleString()}
            </div>
            <div className="p-2 bg-muted/20 border border-border text-muted-foreground">
              <span className="text-foreground font-medium">Completed At: </span>
              {execution.completedAt ? new Date(execution.completedAt).toLocaleString() : new Date(new Date(execution.executedAt).getTime() + (execution.durationMs ?? execution.responseTimeMs)).toLocaleString()}
            </div>
          </div>

          {/* Error Callout */}
          {(execution.errorMessage || execution.errorType) && execution.status !== 'SUCCESS' && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold block">Failure Reason</span>
                {execution.errorType && (
                  <Badge variant="outline" className="font-mono text-[9px] bg-destructive/20 text-destructive border-destructive/40">
                    {execution.errorType}
                  </Badge>
                )}
              </div>
              <p className="font-mono text-[11px] break-all">{execution.errorMessage || 'Execution encountered an unexpected error.'}</p>
            </div>
          )}

          {/* Schema Validation Result */}
          {execution.schemaValid !== undefined && (
            <div className="p-2.5 border border-border bg-muted/10 flex items-center justify-between text-xs font-mono">
              <span className="text-foreground font-medium">Schema Contract Result:</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  execution.schemaValid
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {execution.schemaValid ? "VALID" : "SCHEMA_ERROR"}
              </Badge>
            </div>
          )}

          {/* Assertion Results */}
          {execution.assertionResults && Array.isArray(execution.assertionResults) && execution.assertionResults.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-semibold text-foreground block text-xs">
                Assertion Results
              </span>
              <div className="space-y-1">
                {execution.assertionResults.map((a: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2 border border-border bg-muted/10 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <span className="text-foreground font-medium">{a.type || "Check"}: </span>
                      {a.expected !== undefined && (
                        <span className="text-muted-foreground">
                          expected {a.expected}, got {a.actual ?? "—"}
                        </span>
                      )}
                      {a.errors && Array.isArray(a.errors) && a.errors.length > 0 && (
                        <div className="text-[10px] text-destructive mt-0.5">
                          {a.errors.join("; ")}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        a.passed
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}
                    >
                      {a.passed ? "PASSED" : "FAILED"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Redacted Safe Response Headers */}
          {execution.responseHeaders && Object.keys(execution.responseHeaders).length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="font-semibold text-foreground block text-xs">
                Response Headers (Tokens Redacted)
              </span>
              <div className="max-h-28 overflow-y-auto p-2 bg-muted/20 border border-border font-mono text-[10px] space-y-0.5">
                {Object.entries(execution.responseHeaders).map(([key, val]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="text-foreground break-all">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
