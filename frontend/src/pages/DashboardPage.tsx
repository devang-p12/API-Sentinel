import { useState, useEffect, useCallback, useMemo } from "react"
import { Link } from "react-router-dom"
import {
  api,
  type CustomerDashboardSummary,
  type ReliabilityTrendPoint,
  type LatencyTrendPoint,
  type ErrorRateTrendPoint,
} from "@/lib/api"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  ApiIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  RefreshIcon,
  Search01Icon,
  ShieldAlertIcon,
  FileCodeIcon,
  Notification01Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons"

// --- Custom SVG Interactive Sparkline / Area Charts (Zero External Chart Library) ---

function ReliabilityTrendChart({ data }: { data: ReliabilityTrendPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/60">
        No reliability data points recorded yet
      </div>
    )
  }

  const width = 400
  const height = 120
  const padding = 16

  const minScore = 70
  const maxScore = 100
  const range = maxScore - minScore || 1

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2)
    const clampedScore = Math.max(minScore, Math.min(maxScore, d.score))
    const y = height - padding - ((clampedScore - minScore) / range) * (height - padding * 2)
    return { x, y, score: d.score, timestamp: d.timestamp }
  })

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, "")

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : ""

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : points[points.length - 1]

  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="font-mono">24h History</span>
        <span className="font-mono font-medium text-emerald-400">
          {activePoint ? `${activePoint.score}% Score` : "--%"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-28 overflow-visible"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="reliabilityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />

        {/* Gradient Area */}
        <path d={areaD} fill="url(#reliabilityGrad)" />

        {/* Stroke Line */}
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 4.5 : 2}
            className={`transition-all duration-150 cursor-pointer ${
              hoveredIndex === i ? "fill-emerald-400 stroke-background stroke-2" : "fill-emerald-500"
            }`}
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}
      </svg>
    </div>
  )
}

function LatencyTrendChart({ data }: { data: LatencyTrendPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/60">
        No latency telemetry points recorded yet
      </div>
    )
  }

  const width = 400
  const height = 120
  const padding = 16

  const maxLatency = Math.max(50, ...data.map((d) => d.p95Ms)) * 1.15

  const pointsP95 = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2)
    const y = height - padding - (d.p95Ms / maxLatency) * (height - padding * 2)
    return { x, y, val: d.p95Ms, avg: d.avgMs, timestamp: d.timestamp }
  })

  const pathP95 = pointsP95.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, "")

  const activePoint = hoveredIndex !== null ? pointsP95[hoveredIndex] : pointsP95[pointsP95.length - 1]

  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="font-mono">P95 Telemetry</span>
        <span className="font-mono font-medium text-cyan-400">
          {activePoint ? `${activePoint.val} ms` : "-- ms"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-28 overflow-visible"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />

        {/* Path */}
        <path d={pathP95} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive Points */}
        {pointsP95.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 4.5 : 2}
            className={`transition-all duration-150 cursor-pointer ${
              hoveredIndex === i ? "fill-cyan-400 stroke-background stroke-2" : "fill-cyan-500"
            }`}
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}
      </svg>
    </div>
  )
}

function ErrorRateTrendChart({ data }: { data: ErrorRateTrendPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/60">
        No error rate points recorded yet
      </div>
    )
  }

  const width = 400
  const height = 120
  const padding = 16

  const maxErr = Math.max(5, ...data.map((d) => d.errorRatePct)) * 1.2

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2)
    const y = height - padding - (d.errorRatePct / maxErr) * (height - padding * 2)
    return { x, y, val: d.errorRatePct, timestamp: d.timestamp }
  })

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, "")

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : points[points.length - 1]

  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="font-mono">Failures / Errors</span>
        <span className={`font-mono font-medium ${activePoint && activePoint.val > 0 ? "text-rose-400" : "text-emerald-400"}`}>
          {activePoint ? `${activePoint.val}%` : "0.0%"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-28 overflow-visible"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />

        {/* Path */}
        <path d={pathD} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 4.5 : 2}
            className={`transition-all duration-150 cursor-pointer ${
              hoveredIndex === i ? "fill-rose-400 stroke-background stroke-2" : "fill-rose-500"
            }`}
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}
      </svg>
    </div>
  )
}

export function DashboardPage() {
  const [data, setData] = useState<CustomerDashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [healthFilter, setHealthFilter] = useState<string>("ALL")

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      const summary = await api.getCustomerDashboardSummary()
      setData(summary)
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard summary")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
    // Periodic gentle refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboard(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [loadDashboard])

  // Filtered API health table rows
  const filteredTable = useMemo(() => {
    if (!data?.apiHealthTable) return []
    return data.apiHealthTable.filter((row) => {
      const matchesSearch =
        row.apiName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.service && row.service.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesHealth = healthFilter === "ALL" || row.health === healthFilter
      return matchesSearch && matchesHealth
    })
  }, [data?.apiHealthTable, searchQuery, healthFilter])

  // Helper for Health badge styles
  const getHealthBadge = (health: 'HEALTHY' | 'DEGRADED' | 'DOWN') => {
    switch (health) {
      case 'HEALTHY':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 font-mono text-[11px]">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            HEALTHY
          </Badge>
        )
      case 'DEGRADED':
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 font-mono text-[11px]">
            <span className="size-1.5 rounded-full bg-amber-400" />
            DEGRADED
          </Badge>
        )
      case 'DOWN':
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-1 font-mono text-[11px]">
            <span className="size-1.5 rounded-full bg-rose-400 animate-ping" />
            DOWN
          </Badge>
        )
    }
  }

  // --- SKELETON LOADING STATE ---
  if (isLoading && !data) {
    return (
      <PageContainer
        title="Customer Dashboard"
        description="Comprehensive real-time health, reliability, telemetry, and contract metrics across your API ecosystem."
        breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Dashboard" }]}
      >
        <div className="space-y-6 animate-pulse">
          {/* KPI Skeletons */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-24 bg-card/60 border-border/50" />
            ))}
          </div>

          {/* Table Skeleton */}
          <Card className="h-80 bg-card/60 border-border/50" />

          {/* Trends Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="h-48 bg-card/60 border-border/50" />
            <Card className="h-48 bg-card/60 border-border/50" />
            <Card className="h-48 bg-card/60 border-border/50" />
          </div>
        </div>
      </PageContainer>
    )
  }

  // --- ERROR STATE ---
  if (error && !data) {
    return (
      <PageContainer
        title="Customer Dashboard"
        description="Real-time API Sentinel metrics and health status."
        breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Dashboard" }]}
      >
        <Card className="border-rose-500/40 bg-rose-500/5 p-8 text-center max-w-xl mx-auto my-12">
          <div className="size-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <HugeiconsIcon icon={CancelCircleIcon} className="size-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Failed to Load Dashboard</h3>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => loadDashboard()} className="gap-2">
            <HugeiconsIcon icon={RefreshIcon} className="size-4" />
            Retry Connection
          </Button>
        </Card>
      </PageContainer>
    )
  }

  // --- EMPTY STATE (When no APIs are registered yet) ---
  if (data?.kpis.totalApis === 0) {
    return (
      <PageContainer
        title="Customer Dashboard"
        description="Comprehensive real-time health, reliability, telemetry, and contract metrics across your API ecosystem."
        breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Dashboard" }]}
      >
        <Card className="border-border/60 bg-card p-12 text-center max-w-2xl mx-auto my-8">
          <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-5 border border-primary/20">
            <HugeiconsIcon icon={ApiIcon} className="size-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">Welcome to API Sentinel</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Register your first API to begin agentless monitoring, automatic contract verification, health evaluation, and real-time reliability telemetry.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/apis" className={buttonVariants({ className: "gap-2" })}>
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              Register API
            </Link>
            <Link to="/api-tester" className={buttonVariants({ variant: "outline", className: "gap-2" })}>
              <HugeiconsIcon icon={Activity01Icon} className="size-4" />
              Launch API Tester
            </Link>
          </div>
        </Card>
      </PageContainer>
    )
  }

  const kpis = data!.kpis

  return (
    <PageContainer
      title="Customer Dashboard"
      description="Real-time health, reliability scoring, P95 telemetry, and contract integrity across your API services."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Dashboard" }]}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(true)}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link to="/apis" className={buttonVariants({ size: "sm", className: "gap-1.5" })}>
            <HugeiconsIcon icon={ApiIcon} className="size-3.5" />
            <span>Manage APIs</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* TOP KPIS SECTION                                                          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total APIs */}
          <Card className="border-border bg-card/70 hover:border-border/80 transition-colors">
            <CardHeader className="pb-1 pt-3.5 px-3.5">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Total APIs
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-foreground mt-0.5">
                {kpis.totalApis}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3.5 pb-3 text-[11px] text-muted-foreground">
              Registered endpoints
            </CardContent>
          </Card>

          {/* Healthy */}
          <Card className="border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 transition-colors">
            <CardHeader className="pb-1 pt-3.5 px-3.5">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                Healthy
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                {kpis.healthy}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Optimal
              </Badge>
            </CardContent>
          </Card>

          {/* Degraded */}
          <Card className="border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 transition-colors">
            <CardHeader className="pb-1 pt-3.5 px-3.5">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                Degraded
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
                {kpis.degraded}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                Latency / Warnings
              </Badge>
            </CardContent>
          </Card>

          {/* Down */}
          <Card className="border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 transition-colors">
            <CardHeader className="pb-1 pt-3.5 px-3.5">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-rose-400">
                Down
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-rose-400 mt-0.5">
                {kpis.down}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                Critical Outages
              </Badge>
            </CardContent>
          </Card>

          {/* Active Incidents */}
          <Card className="border-border bg-card/70 hover:border-border/80 transition-colors">
            <CardHeader className="pb-1 pt-3.5 px-3.5">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Active Incidents
              </CardDescription>
              <CardTitle className={`text-2xl font-bold font-mono mt-0.5 ${kpis.activeIncidents > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {kpis.activeIncidents}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <Link to="/incidents" className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5">
                <span>View triage</span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Average Reliability */}
          <Card className="border-border bg-card/70 hover:border-border/80 transition-colors">
            <CardHeader className="pb-1 pt-3.5 px-3.5">
              <CardDescription className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Avg Reliability
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                {kpis.averageReliability}
                <span className="text-xs text-muted-foreground font-normal ml-0.5">/100</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3.5 pb-3 text-[11px] text-muted-foreground">
              Composite score
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* API HEALTH TABLE                                                          */}
        {/* ========================================================================= */}
        <Card className="border-border">
          <CardHeader className="p-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">API Health & Performance Matrix</CardTitle>
                <CardDescription className="text-xs">
                  Real-time status, reliability grading, SLA availability, and latency percentiles.
                </CardDescription>
              </div>

              {/* Table search & filter */}
              <div className="flex items-center gap-2">
                <div className="relative w-44 sm:w-56">
                  <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search APIs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-md border border-border">
                  {["ALL", "HEALTHY", "DEGRADED", "DOWN"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setHealthFilter(f)}
                      className={`text-[10px] font-mono uppercase px-2 py-1 rounded transition-colors ${
                        healthFilter === f
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/30 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">API / Service</th>
                  <th className="py-2.5 px-4 font-semibold">Environment</th>
                  <th className="py-2.5 px-4 font-semibold">Health</th>
                  <th className="py-2.5 px-4 font-semibold">Reliability</th>
                  <th className="py-2.5 px-4 font-semibold">Availability (SLA)</th>
                  <th className="py-2.5 px-4 font-semibold">P95 Latency</th>
                  <th className="py-2.5 px-4 font-semibold">Error Rate</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTable.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No APIs matching current filters
                    </td>
                  </tr>
                ) : (
                  filteredTable.map((row) => (
                    <tr key={row.apiId} className="hover:bg-muted/20 transition-colors group">
                      <td className="py-3 px-4 font-medium text-foreground">
                        <Link to={`/apis/${row.apiId}`} className="hover:text-primary transition-colors flex flex-col">
                          <span className="font-semibold text-sm group-hover:underline">{row.apiName}</span>
                          {row.service && (
                            <span className="text-[11px] text-muted-foreground font-mono">{row.service}</span>
                          )}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {row.environmentName || "default"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5" title={row.healthReason}>
                          {getHealthBadge(row.health)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground w-7">
                            {row.reliability}
                          </span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.reliability >= 90
                                  ? "bg-emerald-500"
                                  : row.reliability >= 75
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, row.reliability))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {row.availability.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className={row.p95LatencyMs > 500 ? "text-amber-400 font-semibold" : "text-foreground"}>
                          {row.p95LatencyMs > 0 ? `${row.p95LatencyMs} ms` : "--"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className={row.errorRate > 0 ? "text-rose-400 font-semibold" : "text-muted-foreground"}>
                          {row.errorRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/apis/${row.apiId}`}
                          className={buttonVariants({ variant: "ghost", size: "sm", className: "h-7 px-2 text-xs gap-1" })}
                        >
                          <span>Details</span>
                          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* TRENDS & TELEMETRY SECTION (RELIABILITY, LATENCY, ERROR RATE)             */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Reliability Trend */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Reliability Trend</span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">Target 99+</span>
              </CardTitle>
              <CardDescription className="text-xs">Composite score moving average</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <ReliabilityTrendChart data={data!.trends.reliabilityTrend} />
            </CardContent>
          </Card>

          {/* Latency Trend */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Latency Trend</span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">P95 percentile</span>
              </CardTitle>
              <CardDescription className="text-xs">Outbound execution durations</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <LatencyTrendChart data={data!.trends.latencyTrend} />
            </CardContent>
          </Card>

          {/* Error Rate Trend */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Error Rate Trend</span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">Target &lt; 1%</span>
              </CardTitle>
              <CardDescription className="text-xs">HTTP 4xx/5xx and probe timeouts</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <ErrorRateTrendChart data={data!.trends.errorRateTrend} />
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* ADDITIONAL SECTIONS: INCIDENTS, SCHEMA CHANGES, ACTIVE ALERTS             */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Incidents */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <HugeiconsIcon icon={ShieldAlertIcon} className="size-4 text-rose-400" />
                  <span>Recent Incidents</span>
                </CardTitle>
                <CardDescription className="text-xs">Outages and SLA degradations</CardDescription>
              </div>
              <Link to="/incidents" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-3 divide-y divide-border/60">
              {data!.recentIncidents.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6 text-emerald-400" />
                  <span>No active or recent incidents.</span>
                </div>
              ) : (
                data!.recentIncidents.map((inc) => (
                  <div key={inc.id} className="py-2.5 first:pt-1 last:pb-1 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground truncate max-w-[180px]">
                        {inc.apiName} ({inc.environmentName})
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          inc.status === "RESOLVED"
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : "border-rose-500/30 text-rose-400 bg-rose-500/10 animate-pulse"
                        }`}
                      >
                        {inc.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{inc.reason}</p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground font-mono">
                      <span>{new Date(inc.startedAt).toLocaleTimeString()}</span>
                      {inc.durationSeconds && <span>{inc.durationSeconds}s duration</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Schema Changes */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <HugeiconsIcon icon={FileCodeIcon} className="size-4 text-cyan-400" />
                  <span>Recent Schema Changes</span>
                </CardTitle>
                <CardDescription className="text-xs">Contract violations & mutations</CardDescription>
              </div>
              <Link to="/apis" className="text-xs text-primary hover:underline">
                Explore APIs
              </Link>
            </CardHeader>
            <CardContent className="p-3 divide-y divide-border/60">
              {data!.recentSchemaChanges.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6 text-emerald-400" />
                  <span>All API payloads conform to baseline schema.</span>
                </div>
              ) : (
                data!.recentSchemaChanges.map((change) => (
                  <div key={change.id} className="py-2.5 first:pt-1 last:pb-1 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground truncate max-w-[180px]">
                        {change.endpoint}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          change.severity === "BREAKING"
                            ? "border-rose-500/30 text-rose-400 bg-rose-500/10 font-bold"
                            : change.severity === "WARNING"
                            ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                            : "border-blue-500/30 text-blue-400 bg-blue-500/10"
                        }`}
                      >
                        {change.severity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      <span className="font-mono text-foreground">{change.fieldPath}</span>: {change.description}
                    </p>
                    <div className="text-[10px] text-muted-foreground font-mono mt-1">
                      {new Date(change.detectedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Active Alerts */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <HugeiconsIcon icon={Notification01Icon} className="size-4 text-amber-400" />
                  <span>Active Alerts</span>
                </CardTitle>
                <CardDescription className="text-xs">Firing rule conditions</CardDescription>
              </div>
              <Link to="/alerts" className="text-xs text-primary hover:underline">
                View alert rules
              </Link>
            </CardHeader>
            <CardContent className="p-3 divide-y divide-border/60">
              {data!.activeAlerts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6 text-emerald-400" />
                  <span>No alerts currently firing.</span>
                </div>
              ) : (
                data!.activeAlerts.map((alert) => (
                  <div key={alert.id} className="py-2.5 first:pt-1 last:pb-1 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground truncate max-w-[180px]">
                        {alert.alertRuleName}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          alert.severity === "CRITICAL"
                            ? "border-rose-500/30 text-rose-400 bg-rose-500/10 animate-pulse font-bold"
                            : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                        }`}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{alert.message}</p>
                    <div className="text-[10px] text-muted-foreground font-mono mt-1">
                      Metric: <span className="text-foreground">{alert.metric}</span> | Triggered: {new Date(alert.triggeredAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
