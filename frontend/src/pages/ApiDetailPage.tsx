import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  api,
  type Api,
  type Environment,
  type EnvironmentType,
  type ApiDetailsResponse,
} from "@/lib/api"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Edit01Icon,
  Delete01Icon,
  FlashIcon,
  PlayIcon,
  RefreshIcon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  Activity01Icon,
  ShieldAlertIcon,
  FileCodeIcon,
  Notification01Icon,
  GlobeIcon,
  ViewIcon,
  ViewOffIcon,
  Copy01Icon,
} from "@hugeicons/core-free-icons"
import { EnvironmentFormDialog } from "@/components/environments/EnvironmentFormDialog"
import { EditApiDialog } from "@/components/apis/EditApiDialog"

// --- Custom Interactive SVG Performance Charts ---

function PerformanceLatencyChart({ data }: { data: ApiDetailsResponse['performance']['latencyGraph'] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/60">No latency data points available</div>
  }

  const width = 500
  const height = 150
  const padding = 20

  const maxLatency = Math.max(50, ...data.map((d) => d.p95Ms)) * 1.15

  const pointsP95 = data.map((d, i) => ({
    x: padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2),
    y: height - padding - (d.p95Ms / maxLatency) * (height - padding * 2),
    p95: d.p95Ms,
    avg: d.avgMs,
    max: d.maxMs,
    timestamp: d.timestamp,
  }))

  const pathP95 = pointsP95.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "")
  const areaP95 = pointsP95.length > 0
    ? `${pathP95} L ${pointsP95[pointsP95.length - 1].x} ${height - padding} L ${pointsP95[0].x} ${height - padding} Z`
    : ""

  const activePoint = hoveredIdx !== null ? pointsP95[hoveredIdx] : pointsP95[pointsP95.length - 1]

  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="font-mono">P95 & Average Latency (24h)</span>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-cyan-400 font-semibold">P95: {activePoint ? `${activePoint.p95} ms` : "--"}</span>
          <span className="text-muted-foreground">Avg: {activePoint ? `${activePoint.avg} ms` : "--"}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible" onMouseLeave={() => setHoveredIdx(null)}>
        <defs>
          <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <path d={areaP95} fill="url(#p95Grad)" />
        <path d={pathP95} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pointsP95.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : 2}
            className={`transition-all duration-150 cursor-pointer ${
              hoveredIdx === i ? "fill-cyan-300 stroke-background stroke-2" : "fill-cyan-500"
            }`}
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}
      </svg>
    </div>
  )
}

function PerformanceErrorChart({ data }: { data: ApiDetailsResponse['performance']['errorGraph'] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/60">No error rate data available</div>
  }

  const width = 500
  const height = 150
  const padding = 20

  const maxErr = Math.max(5, ...data.map((d) => d.errorRatePct)) * 1.2

  const points = data.map((d, i) => ({
    x: padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2),
    y: height - padding - (d.errorRatePct / maxErr) * (height - padding * 2),
    pct: d.errorRatePct,
    failures: d.failureCount,
    timestamp: d.timestamp,
  }))

  const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "")
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : ""

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1]

  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="font-mono">Error Rate Percentage</span>
        <span className={`font-mono font-semibold ${activePoint && activePoint.pct > 0 ? "text-rose-400" : "text-emerald-400"}`}>
          {activePoint ? `${activePoint.pct}% (${activePoint.failures} fails)` : "0.0%"}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible" onMouseLeave={() => setHoveredIdx(null)}>
        <defs>
          <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <path d={areaD} fill="url(#errGrad)" />
        <path d={pathD} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : 2}
            className={`transition-all duration-150 cursor-pointer ${
              hoveredIdx === i ? "fill-rose-300 stroke-background stroke-2" : "fill-rose-500"
            }`}
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}
      </svg>
    </div>
  )
}

function PerformanceAvailabilityChart({ data }: { data: ApiDetailsResponse['performance']['availabilityGraph'] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/60">No availability data available</div>
  }

  const width = 500
  const height = 150
  const padding = 20

  const minAvail = 70
  const maxAvail = 100
  const range = maxAvail - minAvail || 1

  const points = data.map((d, i) => {
    const clamped = Math.max(minAvail, Math.min(maxAvail, d.availabilityPct))
    return {
      x: padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2),
      y: height - padding - ((clamped - minAvail) / range) * (height - padding * 2),
      val: d.availabilityPct,
      timestamp: d.timestamp,
    }
  })

  const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "")
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : ""

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1]

  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="font-mono">SLA Uptime Availability</span>
        <span className="font-mono font-semibold text-emerald-400">
          {activePoint ? `${activePoint.val.toFixed(1)}%` : "--%"}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible" onMouseLeave={() => setHoveredIdx(null)}>
        <defs>
          <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <path d={areaD} fill="url(#availGrad)" />
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : 2}
            className={`transition-all duration-150 cursor-pointer ${
              hoveredIdx === i ? "fill-emerald-300 stroke-background stroke-2" : "fill-emerald-500"
            }`}
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}
      </svg>
    </div>
  )
}

export function ApiDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [details, setDetails] = useState<ApiDetailsResponse | null>(null)
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  // Modal Dialogs state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditApiOpen, setIsEditApiOpen] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [revealedUrls, setRevealedUrls] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadData = useCallback(async (quiet = false) => {
    if (!id) return
    if (!quiet) setIsLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      const [detailsData, envsData] = await Promise.all([
        api.getApiDetails(id),
        api.getApiEnvironments(id).catch(() => []),
      ])
      setDetails(detailsData)
      setEnvironments(envsData)
    } catch (err: any) {
      console.error("Failed to load API details:", err)
      setError(err?.message || "Failed to load API details")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenAdd = () => {
    setEditingEnv(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (env: Environment) => {
    setEditingEnv(env)
    setIsFormOpen(true)
  }

  const handleCreateOrUpdate = async (data: {
    name: string
    baseUrl: string
    type: EnvironmentType
    variables?: Record<string, any>
  }) => {
    if (!id) return
    if (editingEnv) {
      await api.updateEnvironment(editingEnv.id, data)
    } else {
      await api.createEnvironment(id, data)
    }
    await loadData(true)
  }

  const handleUpdateApi = async (data: {
    name: string
    description?: string
    service?: string
  }) => {
    if (!id) return
    await api.updateApi(id, data)
    await loadData(true)
  }

  const handleDeleteApi = async () => {
    if (!id || !details?.api) return
    if (!window.confirm(`Are you sure you want to delete "${details.api.name}"? This action cannot be undone.`)) {
      return
    }
    try {
      await api.deleteApi(id)
      navigate("/apis")
    } catch (err: any) {
      alert(err?.message || "Failed to delete API")
    }
  }

  const handleDeleteEnv = async (envId: string) => {
    if (!window.confirm("Are you sure you want to delete this environment?")) {
      return
    }
    setDeletingId(envId)
    try {
      await api.deleteEnvironment(envId)
      await loadData(true)
    } catch (err: any) {
      alert(err?.message || "Failed to delete environment")
    } finally {
      setDeletingId(null)
    }
  }

  const toggleRevealUrl = (envId: string) => {
    setRevealedUrls((prev) => ({ ...prev, [envId]: !prev[envId] }))
  }

  const copyToClipboard = (text: string, envId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(envId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getHealthBadge = (health: 'HEALTHY' | 'DEGRADED' | 'DOWN') => {
    switch (health) {
      case 'HEALTHY':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5 font-mono text-xs">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            HEALTHY
          </Badge>
        )
      case 'DEGRADED':
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1.5 font-mono text-xs">
            <span className="size-2 rounded-full bg-amber-400" />
            DEGRADED
          </Badge>
        )
      case 'DOWN':
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-1.5 font-mono text-xs">
            <span className="size-2 rounded-full bg-rose-400 animate-ping" />
            DOWN
          </Badge>
        )
    }
  }

  // --- SKELETON LOADING STATE ---
  if (isLoading && !details) {
    return (
      <PageContainer
        title="API Details"
        description="Loading real-time health, performance telemetry, contracts, incidents, and environments..."
        breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "APIs", href: "/apis" }, { label: "Loading..." }]}
      >
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-24 bg-card/60 border-border/50" />
            ))}
          </div>
          <Card className="h-96 bg-card/60 border-border/50" />
        </div>
      </PageContainer>
    )
  }

  // --- ERROR STATE ---
  if (error && !details) {
    return (
      <PageContainer
        title="API Details"
        description="Real-time telemetry and service status."
        breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "APIs", href: "/apis" }, { label: "Error" }]}
      >
        <Card className="border-rose-500/40 bg-rose-500/5 p-8 text-center max-w-xl mx-auto my-12">
          <div className="size-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <HugeiconsIcon icon={CancelCircleIcon} className="size-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Failed to Load API Details</h3>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <div className="flex justify-center gap-3">
            <Link to="/apis" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to APIs
            </Link>
            <Button onClick={() => loadData()} size="sm" className="gap-2">
              <HugeiconsIcon icon={RefreshIcon} className="size-4" />
              Retry Connection
            </Button>
          </div>
        </Card>
      </PageContainer>
    )
  }

  const { api: apiInfo, overview, performance, monitoring, contract, incidents, alerts, environments: envComparison } = details!

  return (
    <PageContainer
      title={apiInfo.name}
      description={apiInfo.description || `Service tag: ${apiInfo.service || "default"} | Organization ID: ${apiInfo.organizationId}`}
      breadcrumbs={[
        { label: "Sentinel", href: "/dashboard" },
        { label: "APIs", href: "/apis" },
        { label: apiInfo.name },
      ]}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <HugeiconsIcon icon={RefreshIcon} className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditApiOpen(true)}
            className="gap-1.5"
          >
            <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
            <span>Edit API</span>
          </Button>
          <Link
            to={`/api-tester?apiId=${apiInfo.id}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={PlayIcon} className="size-3.5 text-primary" />
            <span>API Tester</span>
          </Link>
          <Link
            to={`/load-tests/new?apiId=${apiInfo.id}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={FlashIcon} className="size-3.5 text-amber-500" />
            <span>Run Load Test</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteApi}
            className="gap-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
          >
            <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* SECTION 1: OVERVIEW METRIC TILES                                          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Health */}
          <Card className="border-border bg-card/70">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Health Status
              </CardDescription>
              <div className="mt-1">{getHealthBadge(overview.health)}</div>
            </CardHeader>
            <CardContent className="p-3.5 pt-1 text-[11px] text-muted-foreground truncate" title={overview.healthReason}>
              {overview.consecutiveFailures > 0 ? `${overview.consecutiveFailures} consecutive fails` : "Operational"}
            </CardContent>
          </Card>

          {/* Reliability */}
          <Card className="border-border bg-card/70">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Reliability
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                {overview.reliabilityScore}
                <span className="text-xs text-muted-foreground font-normal ml-0.5">/100</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-1">
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
                {overview.reliabilityGrade}
              </Badge>
            </CardContent>
          </Card>

          {/* Availability */}
          <Card className="border-border bg-card/70">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Availability SLA
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-foreground mt-0.5">
                {overview.availabilityPct.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-1 text-[11px] text-muted-foreground">
              Uptime compliance
            </CardContent>
          </Card>

          {/* Error Rate */}
          <Card className="border-border bg-card/70">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Error Rate
              </CardDescription>
              <CardTitle className={`text-2xl font-bold font-mono mt-0.5 ${overview.errorRatePct > 1 ? "text-rose-400" : "text-foreground"}`}>
                {overview.errorRatePct.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-1 text-[11px] text-muted-foreground">
              4xx/5xx & timeouts
            </CardContent>
          </Card>

          {/* Average Latency */}
          <Card className="border-border bg-card/70">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Avg Latency
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-foreground mt-0.5">
                {overview.averageLatencyMs} <span className="text-xs font-normal text-muted-foreground">ms</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-1 text-[11px] text-muted-foreground">
              Round-trip probe mean
            </CardContent>
          </Card>

          {/* P95 Latency */}
          <Card className="border-border bg-card/70">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                P95 Latency
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">
                {overview.p95LatencyMs} <span className="text-xs font-normal text-muted-foreground">ms</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-1 text-[11px] text-muted-foreground">
              95th percentile
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* MULTI-SECTION NAVIGATION TABS                                             */}
        {/* ========================================================================= */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/40 p-1 border border-border flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HugeiconsIcon icon={Activity01Icon} className="size-3.5" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HugeiconsIcon icon={FlashIcon} className="size-3.5" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HugeiconsIcon icon={GlobeIcon} className="size-3.5" />
              <span>Monitoring</span>
              {monitoring.failures.length > 0 && (
                <Badge variant="destructive" className="size-4 p-0 flex items-center justify-center text-[9px] rounded-full">
                  {monitoring.failures.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contract" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HugeiconsIcon icon={FileCodeIcon} className="size-3.5" />
              <span>Contract & Schema</span>
              {contract.breakingChangesCount > 0 && (
                <Badge variant="destructive" className="size-4 p-0 flex items-center justify-center text-[9px] rounded-full">
                  {contract.breakingChangesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HugeiconsIcon icon={ShieldAlertIcon} className="size-3.5" />
              <span>Incidents</span>
              {incidents.activeIncidents.length > 0 && (
                <Badge variant="destructive" className="size-4 p-0 flex items-center justify-center text-[9px] rounded-full">
                  {incidents.activeIncidents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HugeiconsIcon icon={Notification01Icon} className="size-3.5" />
              <span>Alerts</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {alerts.configuredAlerts.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="environments" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HugeiconsIcon icon={GlobeIcon} className="size-3.5" />
              <span>Environments</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {envComparison.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 1: OVERVIEW & ENVIRONMENT COMPARISON MATRIX                         */}
          {/* ----------------------------------------------------------------------- */}
          <TabsContent value="overview" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Environment Comparison Matrix</CardTitle>
                  <CardDescription className="text-xs">
                    Multi-environment benchmarking for availability, latency, errors, and reliability.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenAdd} className="gap-1.5 text-xs">
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                  <span>Add Environment</span>
                </Button>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/30 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Environment</th>
                      <th className="py-2.5 px-4 font-semibold">Type</th>
                      <th className="py-2.5 px-4 font-semibold">Health</th>
                      <th className="py-2.5 px-4 font-semibold">Availability</th>
                      <th className="py-2.5 px-4 font-semibold">Average Latency</th>
                      <th className="py-2.5 px-4 font-semibold">P95 Latency</th>
                      <th className="py-2.5 px-4 font-semibold">Error Rate</th>
                      <th className="py-2.5 px-4 font-semibold">Reliability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {envComparison.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          No environments configured for this API yet.
                        </td>
                      </tr>
                    ) : (
                      envComparison.map((env) => (
                        <tr key={env.environmentId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">
                            {env.environmentName}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] font-mono uppercase">
                              {env.environmentType}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {getHealthBadge(env.health)}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-foreground">
                            {env.availability.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {env.latency > 0 ? `${env.latency} ms` : "--"}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-cyan-400">
                            {env.p95 > 0 ? `${env.p95} ms` : "--"}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className={env.errors > 0 ? "text-rose-400 font-semibold" : "text-muted-foreground"}>
                              {env.errors.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold w-6">{env.reliability}</span>
                              <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    env.reliability >= 90
                                      ? "bg-emerald-500"
                                      : env.reliability >= 75
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, env.reliability))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Health Diagnostic</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-xs space-y-2">
                  <p className="text-muted-foreground leading-relaxed">{overview.healthReason}</p>
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-muted-foreground text-[11px] font-mono">
                    <span>Last Successful Check:</span>
                    <span className="text-foreground">
                      {overview.lastSuccessfulCheck ? new Date(overview.lastSuccessfulCheck).toLocaleTimeString() : "Never"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-[11px] font-mono">
                    <span>Last Failed Check:</span>
                    <span className="text-rose-400">
                      {overview.lastFailedCheck ? new Date(overview.lastFailedCheck).toLocaleTimeString() : "None"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Service Details</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-xs space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Service Identifier:</span>
                    <span className="font-mono text-foreground">{apiInfo.service || "None"}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Registered Project:</span>
                    <span className="font-medium text-foreground">{apiInfo.projectName || "Standalone API"}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Created Date:</span>
                    <span className="font-mono text-foreground">{new Date(apiInfo.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 2: PERFORMANCE GRAPHS                                               */}
          {/* ----------------------------------------------------------------------- */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Latency Graph</CardTitle>
                  <CardDescription className="text-xs">P95 & average durations (ms)</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <PerformanceLatencyChart data={performance.latencyGraph} />
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Error Graph</CardTitle>
                  <CardDescription className="text-xs">4xx/5xx failures percentage</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <PerformanceErrorChart data={performance.errorGraph} />
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Availability Graph</CardTitle>
                  <CardDescription className="text-xs">Uptime compliance percentage</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <PerformanceAvailabilityChart data={performance.availabilityGraph} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 3: MONITORING TELEMETRY & RECENT CHECKS                             */}
          {/* ----------------------------------------------------------------------- */}
          <TabsContent value="monitoring" className="space-y-4">
            {/* Response Time Distribution */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { label: "Min Latency", val: `${monitoring.responseTimes.minMs} ms` },
                { label: "Average", val: `${monitoring.responseTimes.avgMs} ms` },
                { label: "P50", val: `${monitoring.responseTimes.p50Ms} ms` },
                { label: "P90", val: `${monitoring.responseTimes.p90Ms} ms` },
                { label: "P95", val: `${monitoring.responseTimes.p95Ms} ms`, accent: true },
                { label: "P99", val: `${monitoring.responseTimes.p99Ms} ms` },
                { label: "Max Peak", val: `${monitoring.responseTimes.maxMs} ms` },
              ].map((stat, i) => (
                <Card key={i} className="border-border bg-card/60 p-3 text-center">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">{stat.label}</div>
                  <div className={`text-base font-bold font-mono mt-0.5 ${stat.accent ? "text-cyan-400" : "text-foreground"}`}>
                    {stat.val}
                  </div>
                </Card>
              ))}
            </div>

            {/* Recent Checks Table */}
            <Card className="border-border">
              <CardHeader className="p-4 border-b border-border">
                <CardTitle className="text-sm font-semibold">Recent Probe Executions</CardTitle>
                <CardDescription className="text-xs">
                  Latest outbound health checks evaluated across environments.
                </CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/30 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                      <th className="py-2.5 px-4 font-semibold">Environment</th>
                      <th className="py-2.5 px-4 font-semibold">Status Code</th>
                      <th className="py-2.5 px-4 font-semibold">Latency</th>
                      <th className="py-2.5 px-4 font-semibold">Result</th>
                      <th className="py-2.5 px-4 font-semibold">Error Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {monitoring.recentChecks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No monitoring probe executions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      monitoring.recentChecks.map((check) => (
                        <tr key={check.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-muted-foreground">
                            {new Date(check.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {check.environmentName || "default"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold">
                            <span className={check.statusCode && check.statusCode >= 400 ? "text-rose-400" : "text-foreground"}>
                              {check.statusCode || "--"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono">
                            {check.latencyMs} ms
                          </td>
                          <td className="py-2.5 px-4">
                            {check.success ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                                SUCCESS
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">
                                {check.timeout ? "TIMEOUT" : "FAILED"}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">
                            {check.errorType || (check.errorMessage ? check.errorMessage : "--")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 4: CONTRACT & SCHEMA MONITORING                                     */}
          {/* ----------------------------------------------------------------------- */}
          <TabsContent value="contract" className="space-y-4">
            {contract.schemas.length === 0 ? (
              <Card className="border-border p-8 text-center">
                <HugeiconsIcon icon={FileCodeIcon} className="size-8 text-muted-foreground mx-auto mb-3" />
                <h4 className="text-sm font-semibold mb-1">No Schema Baselines Established</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Run a check in the API Tester or enable scheduled monitoring to automatically capture response schemas.
                </p>
              </Card>
            ) : (
              contract.schemas.map((schema) => (
                <div key={schema.id} className="space-y-4">
                  <Card className="border-border">
                    <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold font-mono flex items-center gap-2">
                          <span className="text-cyan-400">{schema.method}</span>
                          <span>{schema.endpoint}</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Active baseline established on {new Date(schema.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {schema.versions.length} Version{schema.versions.length !== 1 ? "s" : ""}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Current Schema Representation */}
                      <div>
                        <div className="text-xs font-semibold mb-1.5 flex items-center justify-between">
                          <span>Current Normalized Schema</span>
                          <span className="text-[10px] font-mono text-muted-foreground">Active Contract Baseline</span>
                        </div>
                        <pre className="p-3 bg-muted/40 border border-border rounded-md text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
                          {JSON.stringify(schema.currentSchema, null, 2)}
                        </pre>
                      </div>

                      {/* Recorded Schema Changes */}
                      <div>
                        <div className="text-xs font-semibold mb-2">Detected Contract Changes</div>
                        {schema.changes.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic py-2">
                            No contract mutations detected. Payloads conform 100% to baseline.
                          </div>
                        ) : (
                          <div className="divide-y divide-border/60 border border-border rounded-md">
                            {schema.changes.map((change) => (
                              <div key={change.id} className="p-2.5 text-xs flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold text-foreground">{change.fieldPath}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] font-mono ${
                                        change.severity === "BREAKING"
                                          ? "border-rose-500/30 text-rose-400 bg-rose-500/10 font-bold"
                                          : change.severity === "WARNING"
                                          ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                                          : "border-blue-500/30 text-blue-400 bg-blue-500/10"
                                      }`}
                                    >
                                      {change.severity}
                                    </Badge>
                                    <span className="text-[10px] font-mono text-muted-foreground">{change.changeType}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">{change.description}</p>
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground">
                                  {new Date(change.detectedAt).toLocaleTimeString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))
            )}
          </TabsContent>

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 5: INCIDENTS                                                        */}
          {/* ----------------------------------------------------------------------- */}
          <TabsContent value="incidents" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active Incidents */}
              <Card className="border-border">
                <CardHeader className="p-4 border-b border-border">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <HugeiconsIcon icon={ShieldAlertIcon} className="size-4 text-rose-400" />
                    <span>Active Incidents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 divide-y divide-border/60">
                  {incidents.activeIncidents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6 text-emerald-400" />
                      <span>No active incidents on this API.</span>
                    </div>
                  ) : (
                    incidents.activeIncidents.map((inc) => (
                      <div key={inc.id} className="py-3 first:pt-0 last:pb-0 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">{inc.title}</span>
                          <Badge variant="destructive" className="text-[10px] font-mono animate-pulse">
                            {inc.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{inc.reason}</p>
                        <div className="text-[10px] font-mono text-muted-foreground mt-1">
                          Environment: {inc.environmentName} | Started: {new Date(inc.startedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Historical Incidents */}
              <Card className="border-border">
                <CardHeader className="p-4 border-b border-border">
                  <CardTitle className="text-sm font-semibold">Resolved Incident History</CardTitle>
                </CardHeader>
                <CardContent className="p-4 divide-y divide-border/60">
                  {incidents.historicalIncidents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No past incidents recorded.
                    </div>
                  ) : (
                    incidents.historicalIncidents.map((inc) => (
                      <div key={inc.id} className="py-3 first:pt-0 last:pb-0 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">{inc.title}</span>
                          <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                            RESOLVED
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{inc.reason}</p>
                        <div className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center justify-between">
                          <span>Resolved: {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleTimeString() : "--"}</span>
                          {inc.durationSeconds && <span>Duration: {inc.durationSeconds}s</span>}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 6: ALERTS                                                           */}
          {/* ----------------------------------------------------------------------- */}
          <TabsContent value="alerts" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Configured Alert Rules</CardTitle>
                  <CardDescription className="text-xs">
                    Sentinel alerting rules monitoring this API's metrics and thresholds.
                  </CardDescription>
                </div>
                <Link to="/alert-rules/new" className={buttonVariants({ size: "sm", className: "text-xs gap-1.5" })}>
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                  <span>Create Alert</span>
                </Link>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/30 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Rule Name</th>
                      <th className="py-2.5 px-4 font-semibold">Condition</th>
                      <th className="py-2.5 px-4 font-semibold">Threshold</th>
                      <th className="py-2.5 px-4 font-semibold">Severity</th>
                      <th className="py-2.5 px-4 font-semibold">Cooldown</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {alerts.configuredAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No alert rules configured for this API.
                        </td>
                      </tr>
                    ) : (
                      alerts.configuredAlerts.map((a) => (
                        <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">
                            {a.name}
                          </td>
                          <td className="py-3 px-4 font-mono text-cyan-400">
                            {a.metric} {a.operator || ">"}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            {a.threshold}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono ${
                                a.severity === "CRITICAL"
                                  ? "border-rose-500/30 text-rose-400 bg-rose-500/10 font-bold"
                                  : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                              }`}
                            >
                              {a.severity}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {a.cooldownSeconds}s
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono ${
                                a.enabled
                                  ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                  : "border-muted text-muted-foreground"
                              }`}
                            >
                              {a.enabled ? "ENABLED" : "DISABLED"}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 7: ENVIRONMENTS MANAGEMENT                                          */}
          {/* ----------------------------------------------------------------------- */}
          <TabsContent value="environments" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Registered Environments</CardTitle>
                  <CardDescription className="text-xs">
                    Development, UAT, Staging, and Production environment endpoints.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenAdd} className="gap-1.5 text-xs">
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                  <span>Add Environment</span>
                </Button>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/30 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Environment</th>
                      <th className="py-2.5 px-4 font-semibold">Type</th>
                      <th className="py-2.5 px-4 font-semibold">Target URL</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {environments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          No environments created yet.
                        </td>
                      </tr>
                    ) : (
                      environments.map((env) => {
                        const isRevealed = revealedUrls[env.id] || false
                        const isCopied = copiedId === env.id
                        const displayUrl = isRevealed ? env.baseUrl : (env.maskedBaseUrl || env.baseUrl)

                        return (
                          <tr key={env.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4 font-semibold text-foreground">
                              {env.name}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-[10px] font-mono uppercase">
                                {env.type}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 font-mono text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[240px] sm:max-w-md">{displayUrl || "Not configured"}</span>
                                {env.baseUrl && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => toggleRevealUrl(env.id)}
                                      className="text-muted-foreground hover:text-foreground"
                                      title={isRevealed ? "Mask URL" : "Reveal URL"}
                                    >
                                      <HugeiconsIcon icon={isRevealed ? ViewOffIcon : ViewIcon} className="size-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(env.baseUrl || "", env.id)}
                                      className="text-muted-foreground hover:text-foreground"
                                      title="Copy URL"
                                    >
                                      <HugeiconsIcon icon={isCopied ? CheckmarkCircle02Icon : Copy01Icon} className={`size-3.5 ${isCopied ? "text-emerald-400" : ""}`} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEdit(env)}
                                  className="h-7 px-2 text-xs"
                                >
                                  <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteEnv(env.id)}
                                  disabled={deletingId === env.id}
                                  className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                >
                                  <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit API Modal Dialog */}
      <EditApiDialog
        open={isEditApiOpen}
        onOpenChange={setIsEditApiOpen}
        apiItem={details ? { id: apiInfo.id, name: apiInfo.name, service: apiInfo.service, description: apiInfo.description } as Api : null}
        onSubmit={handleUpdateApi}
      />

      {/* Add / Edit Environment Modal Dialog */}
      <EnvironmentFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        apiName={apiInfo.name}
        environment={editingEnv}
        onSubmit={handleCreateOrUpdate}
      />
    </PageContainer>
  )
}
