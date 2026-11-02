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
  const [runPillResult, setRunPillResult] = useState<{
    success: boolean
    statusCode: number | null
    durationMs: number
    errorType: string | null
  } | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [error, setError] = useState<string | null>(null)

  // Dialogs
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<MonitorExecution | null>(null)

  const fetchExecutions = useCallback(async (monitorId: string) => {
    try {
      setIsLoadingExecutions(true)
      const data = await api.getMonitorExecutions(monitorId, 50)
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
    if (!monitor || isRunningManual) return
    try {
      setIsRunningManual(true)
      const triggerTime = Date.now()
      const res = await api.triggerMonitorRun(monitor.id)

      if (res?.execution) {
        const newest = res.execution
        const isSuccess = newest.status === "SUCCESS" || Boolean(newest.success)
        setRunPillResult({
          success: isSuccess,
          statusCode: newest.statusCode ?? null,
          durationMs: newest.durationMs ?? newest.latencyMs ?? newest.responseTimeMs ?? 0,
          errorType: newest.errorType ?? (newest.status !== "SUCCESS" ? newest.status : null),
        })
        await fetchExecutions(monitor.id)
        setIsRunningManual(false)
        return
      }

      // Poll every 350ms to detect the new execution result
      let attempts = 0
      const pollTimer = setInterval(async () => {
        attempts++
        try {
          const fresh = await api.getMonitorExecutions(monitor.id, 10)
          if (fresh.length > 0) {
            const newest = fresh[0]
            const execTimestamp = new Date(newest.executedAt).getTime()
            if (execTimestamp >= triggerTime - 1000 || attempts >= 8) {
              clearInterval(pollTimer)
              setExecutions(fresh)
              const isSuccess = newest.status === "SUCCESS" || (newest as any).success === true
              setRunPillResult({
                success: isSuccess,
                statusCode: newest.statusCode,
                durationMs: newest.durationMs ?? newest.responseTimeMs,
                errorType: (newest as any).errorType ?? (newest.status !== "SUCCESS" ? newest.status : null),
              })
              setIsRunningManual(false)
              return
            }
          }
          if (attempts >= 8) {
            clearInterval(pollTimer)
            setIsRunningManual(false)
            fetchExecutions(monitor.id)
          }
        } catch {
          if (attempts >= 8) {
            clearInterval(pollTimer)
            setIsRunningManual(false)
          }
        }
      }, 350)
    } catch (err: any) {
      setIsRunningManual(false)
      alert(err?.message || "Failed to trigger run.")
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
      headers: data.headers,
      body: data.body,
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

  // Operational Status calculation (Section 35)
  const opStatus = (() => {
    if (!executions || executions.length === 0) {
      return {
        state: "UNKNOWN" as const,
        lastCheckTime: "Never",
        latencyMs: null,
        statusCode: null,
        errorType: null,
        uptimePercentage: null,
      }
    }

    const latest = executions[0]
    const lastCheckTime = new Date(latest.executedAt).toLocaleTimeString()
    const latencyMs = latest.durationMs ?? latest.responseTimeMs
    const statusCode = latest.statusCode
    const errorType = (latest as any).errorType ?? (latest.status !== "SUCCESS" ? latest.status : null)

    const successfulCount = executions.filter(
      (e) => e.status === "SUCCESS" || (e as any).success === true
    ).length
    const uptimePercentage = Math.round((successfulCount / executions.length) * 1000) / 10

    let state: "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN" = "HEALTHY"
    if (!monitor.isActive) {
      state = "UNKNOWN"
    } else if (latest.status !== "SUCCESS" && !(latest as any).success) {
      state = "DOWN"
    } else if (latencyMs > 800 || (executions.slice(0, 5).some((e) => e.status !== "SUCCESS" && !(e as any).success))) {
      state = "DEGRADED"
    } else {
      state = "HEALTHY"
    }

    return {
      state,
      lastCheckTime,
      latencyMs,
      statusCode,
      errorType,
      uptimePercentage,
    }
  })()

  // Filtered executions for Section 37
  const filteredExecutions = executions.filter((exec) => {
    if (statusFilter === "ALL") return true
    if (statusFilter === "SUCCESS") return exec.status === "SUCCESS" || (exec as any).success === true
    return exec.status === statusFilter || (exec as any).errorType === statusFilter
  })

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

          <Link
            to={`/api-tester?url=${encodeURIComponent(composedUrl)}&method=${monitor.method}&apiId=${monitor.environment?.api?.id || ''}&environmentId=${monitor.environmentId || ''}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
            title="Open and inspect this probe inside API Tester"
          >
            <HugeiconsIcon icon={PlayIcon} className="size-3.5 text-primary" />
            <span>Open in API Tester</span>
          </Link>

          {/* Section 36: Run Now Button & Result Pill */}
          <Button
            size="sm"
            onClick={handleRunNow}
            disabled={isRunningManual}
            className="gap-1.5 font-medium"
          >
            {isRunningManual ? (
              <>
                <span className="size-2 rounded-full bg-primary-foreground animate-ping" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                <span>Run Now</span>
              </>
            )}
          </Button>

          {runPillResult && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border rounded ${
                runPillResult.success
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : "bg-destructive/10 text-destructive border-destructive/30"
              }`}
            >
              <span className="font-bold">{runPillResult.success ? "✓" : "✕"}</span>
              <span>
                {runPillResult.statusCode !== null
                  ? runPillResult.statusCode
                  : runPillResult.errorType || "ERR"}
              </span>
              <span className="text-muted-foreground">•</span>
              <span>{runPillResult.durationMs} ms</span>
            </div>
          )}

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
        {/* Section 35: Operational Status Banner */}
        <Card className="rounded-none border-border">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {monitor.environment?.api?.name || "Payment API"}
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {monitor.environment?.name || "Production"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs font-bold px-2.5 py-0.5 ${
                      opStatus.state === "HEALTHY"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        : opStatus.state === "DEGRADED"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        : opStatus.state === "DOWN"
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {opStatus.state === "HEALTHY" && "● Healthy"}
                    {opStatus.state === "DEGRADED" && "▲ Degraded"}
                    {opStatus.state === "DOWN" && "✕ Down"}
                    {opStatus.state === "UNKNOWN" && "○ Unknown"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    Operational status derived from execution history
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-muted/30 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Last check:
                  </span>
                  <span className="font-mono font-semibold text-foreground block">
                    {opStatus.lastCheckTime}
                  </span>
                </div>

                <div className="p-2.5 bg-muted/30 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Latency:
                  </span>
                  <span className="font-mono font-semibold text-foreground block">
                    {opStatus.latencyMs !== null ? `${opStatus.latencyMs} ms` : "—"}
                  </span>
                </div>

                <div className="p-2.5 bg-muted/30 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    HTTP:
                  </span>
                  <span className="font-mono font-semibold text-foreground block">
                    {opStatus.statusCode !== null ? opStatus.statusCode : opStatus.errorType || "—"}
                  </span>
                </div>

                <div className="p-2.5 bg-muted/30 border border-border space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Last 24h:
                  </span>
                  <span className="font-mono font-semibold text-foreground block">
                    {opStatus.uptimePercentage !== null ? `${opStatus.uptimePercentage}% uptime` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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

              {monitor.headers && Object.keys(monitor.headers).length > 0 && (
                <div className="pt-2 border-t border-border space-y-1">
                  <span className="text-foreground font-semibold block text-[11px]">
                    Configured Headers &amp; Authentication:
                  </span>
                  <pre className="p-2 bg-background border border-border text-[11px] font-mono overflow-x-auto text-foreground max-h-32">
                    {JSON.stringify(monitor.headers, null, 2)}
                  </pre>
                </div>
              )}

              {monitor.body && (
                <div className="pt-2 border-t border-border space-y-1">
                  <span className="text-foreground font-semibold block text-[11px]">
                    Request Payload (Body):
                  </span>
                  <pre className="p-2 bg-background border border-border text-[11px] font-mono overflow-x-auto text-foreground max-h-32">
                    {monitor.body}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Executions History Card (Section 37) */}
        <Card className="rounded-none border-border">
          <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Execution History</CardTitle>
                <CardDescription className="text-xs">
                  Historical telemetry recorded by the background monitoring worker.
                </CardDescription>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {["ALL", "SUCCESS", "FAILED", "TIMEOUT", "ERROR"].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => setStatusFilter(status)}
                    className="font-mono text-[10px] h-6 px-2"
                  >
                    {status}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => fetchExecutions(monitor.id)}
                  disabled={isLoadingExecutions}
                  className="font-mono text-[11px] h-6 ml-2"
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
            ) : filteredExecutions.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <HugeiconsIcon icon={Activity01Icon} className="size-5" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h4 className="text-xs font-semibold text-foreground">
                    No Executions Match Filter
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {executions.length === 0
                      ? `This monitor is scheduled to run every ${monitor.intervalSeconds}s. Click "Run Now" to trigger an immediate check.`
                      : `No executions found matching filter "${statusFilter}".`}
                  </p>
                </div>
                {executions.length === 0 && (
                  <Button size="xs" onClick={handleRunNow} disabled={isRunningManual} className="gap-1 mt-2">
                    <HugeiconsIcon icon={PlayIcon} className="size-3" />
                    <span>Execute First Probe</span>
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Time</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">HTTP</TableHead>
                    <TableHead className="text-xs font-semibold">Latency</TableHead>
                    <TableHead className="text-xs font-semibold">Size</TableHead>
                    <TableHead className="text-xs font-semibold">Summary / Error</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExecutions.map((exec) => (
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
                        {exec.durationMs ?? exec.responseTimeMs} ms
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
