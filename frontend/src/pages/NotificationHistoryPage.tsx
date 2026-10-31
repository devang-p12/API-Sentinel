import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Notification01Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Clock01Icon,
  Loading01Icon,
  Cancel01Icon,
  FilterIcon,
  RefreshIcon,
  Link01Icon,
} from "@hugeicons/core-free-icons"
import {
  api,
  type NotificationDelivery,
  type NotificationDeliveryStatus,
  type NotificationEventType,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function NotificationHistoryPage() {
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<NotificationDeliveryStatus | "ALL">("ALL")
  const [eventFilter, setEventFilter] = useState<NotificationEventType | "ALL">("ALL")

  const loadDeliveries = async () => {
    setIsLoading(true)
    try {
      const res = await api.getNotificationDeliveries({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        eventType: eventFilter === "ALL" ? undefined : eventFilter,
        limit: 100,
      })
      setDeliveries(res.items)
      setTotal(res.total)
    } catch (err: any) {
      console.error("Failed to load notification history:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDeliveries()
  }, [statusFilter, eventFilter])

  const getStatusBadge = (status: NotificationDeliveryStatus) => {
    switch (status) {
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="w-3 h-3" />
            SENT
          </span>
        )
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <HugeiconsIcon icon={Clock01Icon} className="w-3 h-3" />
            PENDING
          </span>
        )
      case "SENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <HugeiconsIcon icon={Loading01Icon} className="w-3 h-3 animate-spin" />
            SENDING
          </span>
        )
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            <HugeiconsIcon icon={AlertCircleIcon} className="w-3 h-3" />
            FAILED
          </span>
        )
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
            CANCELLED
          </span>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getEventBadge = (event: NotificationEventType) => {
    switch (event) {
      case "FIRING":
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
            FIRING
          </span>
        )
      case "RECOVERY":
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            RECOVERY
          </span>
        )
      case "REPEAT":
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
            REPEAT
          </span>
        )
      case "TEST":
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
            TEST
          </span>
        )
      default:
        return <Badge variant="secondary">{event}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HugeiconsIcon icon={Notification01Icon} className="w-6 h-6 text-primary" />
            Notification History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audit log of all notification deliveries, dispatch status, retries, and errors.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadDeliveries}
          disabled={isLoading}
          className="gap-2"
        >
          <HugeiconsIcon icon={RefreshIcon} className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Log
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-border bg-card/60">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mr-2">
          <HugeiconsIcon icon={FilterIcon} className="w-4 h-4 text-primary" />
          Filter:
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1">
          {(["ALL", "SENT", "PENDING", "FAILED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border mx-1"></div>

        {/* Event Filter */}
        <div className="flex items-center gap-1">
          {(["ALL", "FIRING", "RECOVERY", "REPEAT", "TEST"] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEventFilter(e)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                eventFilter === e
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{deliveries.length}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span> deliveries
        </div>
      </div>

      {/* Deliveries Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          Loading notification deliveries...
        </div>
      ) : deliveries.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl bg-card/30 text-center">
          <HugeiconsIcon icon={Notification01Icon} className="w-8 h-8 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Deliveries Recorded</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Notifications triggered by incidents or test dispatches will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Related Incident</th>
                  <th className="py-3 px-4">Policy</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {deliveries.map((d) => {
                  const dateStr = new Date(d.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                  const fullDate = new Date(d.createdAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })

                  return (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        <span className="text-foreground font-semibold">{dateStr}</span>
                        <span className="text-[10px] ml-1.5 opacity-70">{fullDate}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">{getEventBadge(d.eventType)}</td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {d.contactPoint?.name || "Unknown Point"}
                        </div>
                        <div className="text-[11px] text-muted-foreground uppercase font-mono">
                          {d.contactPoint?.type}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate">
                        {d.incident ? (
                          <Link
                            to="/incidents"
                            className="font-medium text-primary hover:underline flex items-center gap-1 truncate"
                          >
                            <HugeiconsIcon icon={Link01Icon} className="w-3 h-3 shrink-0" />
                            <span className="truncate">{d.incident.title}</span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic">None (Test Dispatch)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                        {d.policy?.name || "Direct / Default"}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {getStatusBadge(d.status)}
                          {d.errorMessage && (
                            <div className="text-[10px] text-destructive max-w-xs truncate font-mono">
                              {d.errorMessage}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        {d.attemptCount}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
