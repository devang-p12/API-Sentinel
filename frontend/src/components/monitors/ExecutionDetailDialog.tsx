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
                HTTP Code
              </span>
              <span className="font-semibold text-foreground font-mono">
                {execution.statusCode !== null ? execution.statusCode : "—"}
              </span>
            </div>

            <div className="p-2.5 bg-muted/40 border border-border space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                Latency
              </span>
              <span className="font-semibold text-foreground font-mono">
                {execution.responseTimeMs} ms
              </span>
            </div>

            <div className="p-2.5 bg-muted/40 border border-border space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                Payload Size
              </span>
              <span className="font-semibold text-foreground font-mono">
                {execution.responseSize !== null ? `${execution.responseSize} B` : "—"}
              </span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="p-2 bg-muted/20 border border-border font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground font-medium">Executed At: </span>
            {new Date(execution.executedAt).toLocaleString()} ({new Date(execution.executedAt).toISOString()})
          </div>

          {/* Error Callout */}
          {execution.errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <span className="font-semibold block">Failure Reason</span>
              <p className="font-mono text-[11px] break-all">{execution.errorMessage}</p>
            </div>
          )}

          {/* Assertion Results */}
          {execution.assertionResults && Array.isArray(execution.assertionResults) && (
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
