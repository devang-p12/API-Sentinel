import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { api, type Monitor, type Api } from "@/lib/api"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Add01Icon,
  Edit01Icon,
  Delete01Icon,
  ArrowRight01Icon,
  ApiIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { MonitorFormDialog } from "@/components/monitors/MonitorFormDialog"
import { DeleteMonitorDialog } from "@/components/monitors/DeleteMonitorDialog"

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

export function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [apis, setApis] = useState<Api[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedApiFilter, setSelectedApiFilter] = useState("ALL")
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL")

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null)
  const [deletingMonitor, setDeletingMonitor] = useState<Monitor | null>(null)
  const [runningMonitorId, setRunningMonitorId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [fetchedMonitors, fetchedApis] = await Promise.all([
        api.getMonitors(),
        api.getApis(),
      ])
      setMonitors(fetchedMonitors)
      setApis(fetchedApis)
    } catch (err: any) {
      setError(err?.message || "Failed to load monitors.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleToggle = async (monitor: Monitor) => {
    try {
      const nextState = !monitor.isActive
      const updated = await api.toggleMonitor(monitor.id, nextState)
      setMonitors((prev) =>
        prev.map((m) => (m.id === monitor.id ? { ...m, isActive: updated.isActive } : m))
      )
    } catch (err: any) {
      alert(err?.message || "Failed to toggle monitor status.")
    }
  }

  const handleRunNow = async (monitorId: string) => {
    try {
      setRunningMonitorId(monitorId)
      await api.triggerMonitorRun(monitorId)
      await fetchData()
    } catch (err: any) {
      alert(err?.message || "Failed to trigger monitor run.")
    } finally {
      setRunningMonitorId(null)
    }
  }

  const handleCreateSubmit = async (data: any) => {
    await api.createMonitor({
      name: data.name,
      description: data.description,
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
    await fetchData()
  }

  const handleEditSubmit = async (data: any) => {
    if (!editingMonitor) return
    await api.updateMonitor(editingMonitor.id, {
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
    setEditingMonitor(null)
    await fetchData()
  }

  const handleDeleteConfirm = async () => {
    if (!deletingMonitor) return
    await api.deleteMonitor(deletingMonitor.id)
    setMonitors((prev) => prev.filter((m) => m.id !== deletingMonitor.id))
    setDeletingMonitor(null)
  }

  // Filtered monitors list
  const filteredMonitors = monitors.filter((m) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !query ||
      m.name.toLowerCase().includes(query) ||
      m.url.toLowerCase().includes(query) ||
      (m.description && m.description.toLowerCase().includes(query))

    const matchesApi =
      selectedApiFilter === "ALL" || m.environment?.apiId === selectedApiFilter

    const matchesStatus =
      selectedStatusFilter === "ALL" ||
      (selectedStatusFilter === "ENABLED" && m.isActive) ||
      (selectedStatusFilter === "DISABLED" && !m.isActive)

    return matchesSearch && matchesApi && matchesStatus
  })

  return (
    <PageContainer
      title="Monitors"
      description="Configure automated HTTP health checks, outside-in probes, intervals, and expected response codes."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Monitors" }]}
      action={
        <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          <span>Create Monitor</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {error}
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between p-3 bg-card border border-border">
          <div className="flex flex-1 flex-col sm:flex-row gap-2">
            <Input
              placeholder="Search monitors by name, path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs sm:w-64 h-8"
            />

            <select
              value={selectedApiFilter}
              onChange={(e) => setSelectedApiFilter(e.target.value)}
              className="h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono"
            >
              <option value="ALL">All APIs</option>
              {apis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono"
            >
              <option value="ALL">All Statuses</option>
              <option value="ENABLED">Enabled Only</option>
              <option value="DISABLED">Disabled Only</option>
            </select>
          </div>

          <div className="text-xs text-muted-foreground font-mono self-center sm:self-auto">
            {filteredMonitors.length} {filteredMonitors.length === 1 ? "monitor" : "monitors"}
          </div>
        </div>

        {/* Monitors Table or Empty State */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground border border-border bg-card">
            Loading monitor configurations...
          </div>
        ) : monitors.length === 0 ? (
          <Card className="rounded-none border-border border-dashed bg-card/30">
            <CardContent className="py-14 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <HugeiconsIcon icon={Activity01Icon} className="size-6" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-heading font-semibold text-base text-foreground">
                  No Monitors Configured Yet
                </h3>
                <p className="text-xs text-muted-foreground">
                  Create your first monitor to start defining API health checks, scheduled intervals, and expected HTTP status codes.
                </p>
              </div>
              <div className="pt-2">
                <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                  <span>Create Monitor</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : filteredMonitors.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground border border-border bg-card space-y-3">
            <p>No monitors match your filter criteria.</p>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setSearchQuery("")
                setSelectedApiFilter("ALL")
                setSelectedStatusFilter("ALL")
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <Card className="rounded-none border-border">
            <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Monitor Configurations</CardTitle>
                  <CardDescription className="text-xs">
                    Target endpoints, schedules, and active probing state.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Monitor</TableHead>
                    <TableHead className="text-xs font-semibold">API</TableHead>
                    <TableHead className="text-xs font-semibold">Environment</TableHead>
                    <TableHead className="text-xs font-semibold">Method</TableHead>
                    <TableHead className="text-xs font-semibold">Endpoint</TableHead>
                    <TableHead className="text-xs font-semibold">Interval</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMonitors.map((mon) => (
                    <TableRow key={mon.id} className="hover:bg-muted/30">
                      <TableCell className="py-3">
                        <div className="space-y-0.5">
                          <Link
                            to={`/monitors/${mon.id}`}
                            className="font-medium text-xs text-foreground hover:underline flex items-center gap-1.5"
                          >
                            <span>{mon.name}</span>
                          </Link>
                          {mon.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-xs">
                              {mon.description}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        {mon.environment?.api ? (
                          <Link
                            to={`/apis/${mon.environment.api.id}`}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono"
                          >
                            <HugeiconsIcon icon={ApiIcon} className="size-3" />
                            <span>{mon.environment.api.name}</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">--</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <div className="space-y-0.5">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {mon.environment?.name || "Unknown"}
                          </Badge>
                          {mon.environment?.baseUrl && (
                            <span className="text-[10px] font-mono text-muted-foreground block line-clamp-1 max-w-[150px]">
                              {mon.environment.baseUrl}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono font-bold ${getMethodBadgeClass(
                            mon.method
                          )}`}
                        >
                          {mon.method}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 font-mono text-xs text-foreground font-medium">
                        {mon.url}
                      </TableCell>

                      <TableCell className="py-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-mono font-medium text-foreground">
                            {mon.intervalSeconds}s
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground block">
                            timeout: {Math.round(mon.timeoutMs / 1000)}s
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        <button
                          type="button"
                          onClick={() => handleToggle(mon)}
                          title="Click to toggle monitor configuration"
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium border rounded-none transition-colors cursor-pointer select-none"
                          style={{
                            borderColor: mon.isActive
                              ? "var(--primary)"
                              : "var(--border)",
                            backgroundColor: mon.isActive
                              ? "var(--primary-foreground, rgba(34, 197, 94, 0.08))"
                              : "transparent",
                            color: mon.isActive
                              ? "var(--primary)"
                              : "var(--muted-foreground)",
                          }}
                        >
                          <span>{mon.isActive ? "● Enabled" : "○ Disabled"}</span>
                        </button>
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={runningMonitorId === mon.id}
                            onClick={() => handleRunNow(mon.id)}
                            className="gap-1 text-primary hover:text-primary"
                            title="Run monitor now"
                          >
                            <HugeiconsIcon
                              icon={PlayIcon}
                              className={`size-3 ${runningMonitorId === mon.id ? "animate-spin" : ""}`}
                            />
                            <span>{runningMonitorId === mon.id ? "..." : "Run"}</span>
                          </Button>
                          <Link
                            to={`/monitors/${mon.id}`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "xs",
                              className: "gap-1",
                            })}
                          >
                            <span>View</span>
                            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                          </Link>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setEditingMonitor(mon)}
                            className="gap-1"
                          >
                            <HugeiconsIcon icon={Edit01Icon} className="size-3" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            variant="destructive"
                            size="xs"
                            onClick={() => setDeletingMonitor(mon)}
                            className="gap-1"
                          >
                            <HugeiconsIcon icon={Delete01Icon} className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <MonitorFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateSubmit}
      />

      {/* Edit Dialog */}
      <MonitorFormDialog
        open={Boolean(editingMonitor)}
        onOpenChange={(open) => !open && setEditingMonitor(null)}
        monitor={editingMonitor}
        onSubmit={handleEditSubmit}
      />

      {/* Delete Dialog */}
      <DeleteMonitorDialog
        open={Boolean(deletingMonitor)}
        onOpenChange={(open) => !open && setDeletingMonitor(null)}
        monitorName={deletingMonitor?.name}
        monitorId={deletingMonitor?.id}
        onConfirm={handleDeleteConfirm}
      />
    </PageContainer>
  )
}
