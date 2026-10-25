import { useState, useEffect, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { api, type Monitor, type MonitorExecution } from "@/lib/api"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  ArrowLeft01Icon,
  Edit01Icon,
  Delete01Icon,
  ApiIcon,
  PlayIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { MonitorFormDialog } from "@/components/monitors/MonitorFormDialog"
import { DeleteMonitorDialog } from "@/components/monitors/DeleteMonitorDialog"
import {
  ExecutionDetailDialog,
  getStatusBadgeVariant,
} from "@/components/monitors/ExecutionDetailDialog"

function getMethodBadgeClass(method: string) {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    case "POST":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    case "PUT":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20"
    case "PATCH":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20"
    case "DELETE":
      return "bg-destructive/10 text-destructive border-destructive/20"
    default:
      return "bg-purple-500/10 text-purple-500 border-purple-500/20"
  }
}

export function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [executions, setExecutions] = useState<MonitorExecution[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false)
  const [isRunningManual, setIsRunningManual] = useState(false)
  const [manualRunMessage, setManualRunMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Dialogs
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<MonitorExecution | null>(null)

  const fetchExecutions = useCallback(async (monitorId: string) => {
    try {
      setIsLoadingExecutions(true)
      const data = await api.getMonitorExecutions(monitorId, 30)
      setExecutions(data)
    } catch (err: any) {
      console.warn("Could not load executions:", err.message)
    } finally {
      setIsLoadingExecutions(false)
    }
  }, [])

  const fetchMonitor = useCallback(async () => {
    if (!id) return
    try {
      setIsLoading(true)
      setError(null)
      const data = await api.getMonitor(id)
      setMonitor(data)
      await fetchExecutions(data.id)
    } catch (err: any) {
      setError(err?.message || "Failed to load monitor configuration.")
    } finally {
      setIsLoading(false)
    }
  }, [id, fetchExecutions])

  useEffect(() => {
    fetchMonitor()
  }, [fetchMonitor])

  // Periodic polling for execution updates while viewing the monitor (every 10s)
  useEffect(() => {
    if (!id) return
    const interval = setInterval(() => {
      fetchExecutions(id)
    }, 10000)
    return () => clearInterval(interval)
  }, [id, fetchExecutions])

  const handleToggle = async () => {
    if (!monitor) return
    try {
      const nextState = !monitor.isActive
      const updated = await api.toggleMonitor(monitor.id, nextState)
      setMonitor((prev) => (prev ? { ...prev, isActive: updated.isActive } : null))
    } catch (err: any) {
      alert(err?.message || "Failed to toggle monitor status.")
    }
  }

  const handleRunNow = async () => {
    if (!monitor) return
    try {
      setIsRunningManual(true)
      setManualRunMessage("Execution queued in BullMQ worker...")
      await api.triggerMonitorRun(monitor.id)

      // Refresh executions after worker picks up job
      setTimeout(() => {
        fetchExecutions(monitor.id)
      }, 800)
      setTimeout(() => {
        fetchExecutions(monitor.id)
        setManualRunMessage(null)
        setIsRunningManual(false)
      }, 2500)
    } catch (err: any) {
      setManualRunMessage(err?.message || "Failed to trigger run.")
      setIsRunningManual(false)
    }
  }

  const handleEditSubmit = async (data: any) => {
    if (!monitor) return
    await api.updateMonitor(monitor.id, {
      name: data.name,
      description: data.description || null,
      environmentId: data.environmentId,
      method: data.method,
      endpoint: data.endpoint,
      intervalSeconds: data.interval,
      timeoutMs: data.timeout * 1000,
      expectedStatusCode: data.expectedStatus,
      isActive: data.enabled,
    })
    setIsEditOpen(false)
    await fetchMonitor()
  }

  const handleDeleteConfirm = async () => {
    if (!monitor) return
    await api.deleteMonitor(monitor.id)
    navigate("/monitors")
  }

  if (isLoading) {
    return (
      <PageContainer
        title="Loading Monitor..."
        breadcrumbs={[
          { label: "Sentinel", href: "/dashboard" },
          { label: "Monitors", href: "/monitors" },
          { label: "..." },
        ]}
      >
        <div className="p-12 text-center text-xs text-muted-foreground border border-border bg-card">
          Loading monitor configuration details...
        </div>
      </PageContainer>
    )
  }

  if (error || !monitor) {
    return (
      <PageContainer
        title="Monitor Not Found"
        breadcrumbs={[
          { label: "Sentinel", href: "/dashboard" },
          { label: "Monitors", href: "/monitors" },
          { label: "Error" },
        ]}
        action={
          <Link
            to="/monitors"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
            <span>Back to Monitors</span>
          </Link>
        }
      >
        <Card className="rounded-none border-border">
          <CardContent className="py-12 px-6 text-center space-y-3">
            <p className="text-sm font-semibold text-destructive">
              {error || "Monitor not found or inaccessible."}
            </p>
            <p className="text-xs text-muted-foreground">
              Verify the monitor ID or check organizational permissions.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  // Derive composed URL
  const baseUrl = monitor.environment?.baseUrl || ""
  const composedUrl = baseUrl
    ? `${baseUrl.replace(/\/+$/, "")}${monitor.url.startsWith("/") ? monitor.url : `/${monitor.url}`}`
    : monitor.url

  // Find expected status assertion
  const statusAssertion = monitor.assertions?.find(
    (a: any) => a.type === "statusCode" || a.type === "status"
  )
  const expectedStatus = statusAssertion?.expected ?? 200

  return (
    <PageContainer
      title={monitor.name}
      description={monitor.description || "API endpoint monitor configuration."}
      breadcrumbs={[
        { label: "Sentinel", href: "/dashboard" },
        { label: "Monitors", href: "/monitors" },
        { label: monitor.name },
      ]}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/monitors"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
            <span>Back to Monitors</span>
          </Link>

          <Button
            size="sm"
            onClick={handleRunNow}
            disabled={isRunningManual}
            className="gap-1.5 font-medium"
          >
            <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
            <span>{isRunningManual ? "Queuing..." : "Run Now"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleToggle}
            className="gap-1.5 font-mono text-xs"
          >
            <span>{monitor.isActive ? "● Disable Monitor" : "○ Enable Monitor"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="gap-1.5"
          >
            <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
            <span>Edit</span>
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => setIsDeleteOpen(true)}
            className="gap-1.5"
          >
            <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Manual Run Notification Banner */}
        {manualRunMessage && (
          <div className="p-3 bg-primary/10 border border-primary/20 text-primary text-xs font-mono flex items-center justify-between animate-in fade-in-50">
            <span>{manualRunMessage}</span>
            <span className="text-[10px] text-muted-foreground">Polling latest runs...</span>
          </div>
        )}

        {/* Configuration Summary Card */}
        <Card className="rounded-none border-border">
          <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                  <HugeiconsIcon icon={Activity01Icon} className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">{monitor.name}</CardTitle>
                  <CardDescription className="text-xs font-mono">
                    ID: {monitor.id}
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-semibold px-2 py-0.5"
                  style={{
                    borderColor: monitor.isActive ? "var(--primary)" : "var(--border)",
                    color: monitor.isActive ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                >
                  {monitor.isActive ? "● Enabled" : "○ Disabled"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-muted/30 border border-border space-y-1">
                <span className="text-muted-foreground block text-[11px]">API Service</span>
                {monitor.environment?.api ? (
                  <Link
                    to={`/apis/${monitor.environment.api.id}`}
                    className="font-semibold text-foreground hover:underline flex items-center gap-1 font-mono"
                  >
                    <HugeiconsIcon icon={ApiIcon} className="size-3" />
                    <span>{monitor.environment.api.name}</span>
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground font-mono">--</span>
                )}
              </div>

              <div className="p-3 bg-muted/30 border border-border space-y-1">
                <span className="text-muted-foreground block text-[11px]">Environment</span>
                <span className="font-semibold text-foreground font-mono block">
                  {monitor.environment?.name || "--"}
                </span>
                {monitor.environment?.baseUrl && (
                  <span className="text-[10px] text-muted-foreground font-mono block truncate">
                    {monitor.environment.baseUrl}
                  </span>
                )}
              </div>

              <div className="p-3 bg-muted/30 border border-border space-y-1">
                <span className="text-muted-foreground block text-[11px]">Interval</span>
                <span className="font-semibold text-foreground font-mono block">
                  {monitor.intervalSeconds} seconds
                </span>
                <span className="text-[10px] text-muted-foreground font-mono block">
                  Frequency of checks
                </span>
              </div>

              <div className="p-3 bg-muted/30 border border-border space-y-1">
                <span className="text-muted-foreground block text-[11px]">Timeout</span>
                <span className="font-semibold text-foreground font-mono block">
                  {Math.round(monitor.timeoutMs / 1000)} seconds ({monitor.timeoutMs} ms)
                </span>
                <span className="text-[10px] text-muted-foreground font-mono block">
                  Strict probe cutoff
                </span>
              </div>
            </div>

            {/* Request Specification Banner */}
            <div className="p-3 bg-muted/20 border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Composed HTTP Request</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono font-bold ${getMethodBadgeClass(
                    monitor.method
                  )}`}
                >
                  {monitor.method}
                </Badge>
              </div>

              <div className="p-2.5 bg-background border border-border font-mono text-xs text-foreground break-all">
                <span className="text-primary font-bold mr-2">{monitor.method}</span>
                <span>{composedUrl}</span>
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-[11px] font-mono text-muted-foreground">
                <div>
                  <span className="text-foreground font-medium">Expected Status: </span>
                  <Badge variant="outline" className="text-[10px] font-mono ml-1">
                    {expectedStatus}
                  </Badge>
                </div>
                <div>
                  <span className="text-foreground font-medium">Relative Path: </span>
                  <span>{monitor.url}</span>
                </div>
                <div>
                  <span className="text-foreground font-medium">Engine: </span>
                  <span>BullMQ + Redis Worker</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Executions History Card */}
        <Card className="rounded-none border-border">
          <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Executions</CardTitle>
                <CardDescription className="text-xs">
                  Immutable health check history recorded by the background monitoring worker.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => fetchExecutions(monitor.id)}
                  disabled={isLoadingExecutions}
                  className="font-mono text-[11px]"
                >
                  {isLoadingExecutions ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingExecutions && executions.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Loading execution telemetry...
              </div>
            ) : executions.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <HugeiconsIcon icon={Activity01Icon} className="size-5" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h4 className="text-xs font-semibold text-foreground">
                    No Executions Recorded Yet
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    This monitor is scheduled to run every {monitor.intervalSeconds}s. Click "Run Now" above to trigger an immediate check.
                  </p>
                </div>
                <Button size="xs" onClick={handleRunNow} disabled={isRunningManual} className="gap-1 mt-2">
                  <HugeiconsIcon icon={PlayIcon} className="size-3" />
                  <span>Execute First Probe</span>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Executed At</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">HTTP Code</TableHead>
                    <TableHead className="text-xs font-semibold">Response Time</TableHead>
                    <TableHead className="text-xs font-semibold">Size</TableHead>
                    <TableHead className="text-xs font-semibold">Summary / Error</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((exec) => (
                    <TableRow key={exec.id} className="hover:bg-muted/30">
                      <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                        {new Date(exec.executedAt).toLocaleTimeString()}
                      </TableCell>

                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] font-bold ${getStatusBadgeVariant(
                            exec.status
                          )}`}
                        >
                          {exec.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-2.5 font-mono text-xs font-medium text-foreground">
                        {exec.statusCode !== null ? (
                          <span>{exec.statusCode}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-2.5 font-mono text-xs text-foreground">
                        {exec.responseTimeMs} ms
                      </TableCell>

                      <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                        {exec.responseSize !== null ? `${exec.responseSize} B` : "—"}
                      </TableCell>

                      <TableCell className="py-2.5 text-xs">
                        {exec.errorMessage ? (
                          <span className="text-destructive font-mono text-[11px] line-clamp-1 max-w-xs">
                            {exec.errorMessage}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            HTTP {exec.statusCode} OK
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-2.5 text-right">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setSelectedExecution(exec)}
                          className="gap-1 font-mono text-[11px]"
                        >
                          <span>Inspect</span>
                          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <MonitorFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        monitor={monitor}
        onSubmit={handleEditSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteMonitorDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        monitorName={monitor.name}
        monitorId={monitor.id}
        onConfirm={handleDeleteConfirm}
      />

      {/* Execution Telemetry Detail Dialog */}
      <ExecutionDetailDialog
        open={Boolean(selectedExecution)}
        onOpenChange={(open) => !open && setSelectedExecution(null)}
        execution={selectedExecution}
        monitorName={monitor.name}
      />
    </PageContainer>
  )
}
