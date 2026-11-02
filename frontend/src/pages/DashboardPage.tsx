import { useState, useEffect, useCallback, useMemo } from "react"
import { Link } from "react-router-dom"
import {
  api,
  type CustomerDashboardSummary,
  type ApiHealthTableRow,
  type RecentIncidentSummary,
  type RecentSchemaChangeSummary,
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
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  RefreshIcon,
  Search01Icon,
  ShieldAlertIcon,
  FileCodeIcon,
  Notification01Icon,
  Add01Icon,
  ChartLineData01Icon,
  AlertCircleIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "Recently"
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return "Recently"
  const now = new Date()
  const diffSecs = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

interface CombinedEvent {
  id: string
  type: "INCIDENT" | "SCHEMA_CHANGE"
  title: string
  subtitle: string
  badgeText: string
  badgeVariant: "rose" | "amber" | "emerald" | "blue"
  timestamp: string
  linkTo: string
}

export function DashboardPage() {
  const [data, setData] = useState<CustomerDashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"ALL" | "ISSUES">("ALL")

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      const summary = await api.getCustomerDashboardSummary()
      setData(summary)
    } catch (err: any) {
      setError(err?.message || "Failed to load overview data.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(() => {
      loadDashboard(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [loadDashboard])

  const kpis = data?.kpis
  const totalApis = kpis?.totalApis || 0
  const healthyCount = kpis?.healthy || 0
  const degradedCount = kpis?.degraded || 0
  const downCount = kpis?.down || 0
  const activeIncidentsCount = kpis?.activeIncidents || 0


  // Filtered APIs for Fleet list
  const filteredApis = useMemo(() => {
    if (!data?.apiHealthTable) return []
    return data.apiHealthTable.filter((apiRow: ApiHealthTableRow) => {
      const matchesSearch =
        apiRow.apiName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (apiRow.service && apiRow.service.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (apiRow.environmentName && apiRow.environmentName.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesTab = activeTab === "ALL" || (activeTab === "ISSUES" && apiRow.health !== "HEALTHY")
      return matchesSearch && matchesTab
    })
  }, [data?.apiHealthTable, searchQuery, activeTab])

  // APIs requiring attention (prioritized)
  const attentionApis = useMemo(() => {
    if (!data?.apiHealthTable) return []
    return data.apiHealthTable.filter((row: ApiHealthTableRow) => row.health === "DOWN" || row.health === "DEGRADED")
  }, [data?.apiHealthTable])

  // Active / Ongoing Incident Callout
  const activeIncident = useMemo(() => {
    if (!data?.recentIncidents) return null
    return data.recentIncidents.find((i: RecentIncidentSummary) => i.status !== "RESOLVED") || null
  }, [data?.recentIncidents])

  // Unified recent activity feed (incidents + schema drift)
  const recentEvents = useMemo<CombinedEvent[]>(() => {
    if (!data) return []
    const events: CombinedEvent[] = []

    // 1. Incidents
    data.recentIncidents.slice(0, 5).forEach((inc: RecentIncidentSummary) => {
      const isResolved = inc.status === "RESOLVED"
      events.push({
        id: `inc-${inc.id}`,
        type: "INCIDENT",
        title: `${inc.apiName || "API Service"} (${inc.environmentName || "default"})`,
        subtitle: inc.reason || (isResolved ? "Incident resolved" : "Active degradation detected"),
        badgeText: inc.status,
        badgeVariant: isResolved ? "emerald" : "rose",
        timestamp: inc.startedAt,
        linkTo: "/incidents",
      })
    })

    // 2. Schema changes
    data.recentSchemaChanges.slice(0, 5).forEach((ch: RecentSchemaChangeSummary) => {
      const isBreaking = ch.severity === "BREAKING"
      events.push({
        id: `sch-${ch.id}`,
        type: "SCHEMA_CHANGE",
        title: `${ch.endpoint || "Endpoint"} payload mutation`,
        subtitle: `${ch.fieldPath}: ${ch.description}`,
        badgeText: ch.severity || "SCHEMA",
        badgeVariant: isBreaking ? "rose" : ch.severity === "WARNING" ? "amber" : "blue",
        timestamp: ch.detectedAt,
        linkTo: "/contracts",
      })
    })

    // Sort descending by timestamp
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5)
  }, [data])

  // Health Badge component
  const renderHealthBadge = (health: "HEALTHY" | "DEGRADED" | "DOWN") => {
    switch (health) {
      case "HEALTHY":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[11px] gap-1.5 px-2 py-0.5">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            OPERATIONAL
          </Badge>
        )
      case "DEGRADED":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono text-[11px] gap-1.5 px-2 py-0.5">
            <span className="size-1.5 rounded-full bg-amber-400" />
            DEGRADED
          </Badge>
        )
      case "DOWN":
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30 font-mono text-[11px] gap-1.5 px-2 py-0.5">
            <span className="size-1.5 rounded-full bg-rose-400 animate-ping" />
            OUTAGE
          </Badge>
        )
    }
  }

  // --- SKELETON LOADING STATE ---
  if (isLoading && !data) {
    return (
      <PageContainer
        title="Overview"
        description="Operational health and active issues across your API ecosystem."
        breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Overview" }]}
      >
        <div className="space-y-6 animate-pulse">
          {/* Hero Banner Skeleton */}
          <div className="h-44 rounded-xl bg-card/60 border border-border/50" />
          {/* Main Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 h-96 rounded-xl bg-card/60 border border-border/50" />
            <div className="lg:col-span-4 space-y-6">
              <div className="h-48 rounded-xl bg-card/60 border border-border/50" />
              <div className="h-48 rounded-xl bg-card/60 border border-border/50" />
            </div>
          </div>
        </div>
      </PageContainer>
    )
  }

  // --- ERROR STATE ---
  if (error && !data) {
    return (
      <PageContainer
        title="Overview"
        description="Operational health and active issues across your API ecosystem."
        breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Overview" }]}
      >
        <Card className="border-rose-500/30 bg-rose-500/5 p-8 text-center max-w-xl mx-auto my-12">
          <div className="size-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <HugeiconsIcon icon={CancelCircleIcon} className="size-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1 font-heading">
            Unable to load overview
          </h3>
          <p className="text-xs text-muted-foreground mb-6 max-w-md mx-auto">{error}</p>
          <Button onClick={() => loadDashboard()} className="gap-2 text-xs font-mono">
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            Retry Connection
          </Button>
        </Card>
      </PageContainer>
    )
  }

  // --- EMPTY STATE ---
  if (totalApis === 0) {
    return (
      <PageContainer
        title="Overview"
        description="Operational health and active issues across your API ecosystem."
        breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Overview" }]}
      >
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm p-12 text-center max-w-2xl mx-auto my-10">
          <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-5 border border-primary/20">
            <HugeiconsIcon icon={ApiIcon} className="size-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2 font-heading">
            Welcome to API Sentinel
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
            API Sentinel continuously monitors your services, audits payload contracts, and routes alert notifications. Register your first API to start proactive monitoring.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/apis" className={buttonVariants({ className: "gap-2 text-xs font-mono" })}>
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              Register API
            </Link>
            <Link
              to="/api-tester"
              className={buttonVariants({ variant: "outline", className: "gap-2 text-xs font-mono" })}
            >
              <HugeiconsIcon icon={Activity01Icon} className="size-4" />
              Launch API Tester
            </Link>
          </div>
        </Card>
      </PageContainer>
    )
  }

  // Segmented health bar percentages
  const healthyPct = totalApis > 0 ? (healthyCount / totalApis) * 100 : 100
  const degradedPct = totalApis > 0 ? (degradedCount / totalApis) * 100 : 0
  const downPct = totalApis > 0 ? (downCount / totalApis) * 100 : 0

  return (
    <PageContainer
      title="Overview"
      description="Operational health and active issues across your API ecosystem."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Overview" }]}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(true)}
            disabled={isRefreshing}
            className="text-xs font-mono gap-1.5 h-8"
            title="Refresh overview metrics"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Link
            to="/analytics"
            className={buttonVariants({ variant: "outline", size: "sm", className: "text-xs font-mono gap-1.5 h-8" })}
          >
            <HugeiconsIcon icon={ChartLineData01Icon} className="size-3.5" />
            <span className="hidden sm:inline">Analytics</span>
          </Link>

          <Link
            to="/apis"
            className={buttonVariants({ size: "sm", className: "text-xs font-mono gap-1.5 h-8" })}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            <span>Register API</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* 1. PRODUCT BRAND HERO: OVERALL SYSTEM HEALTH STATUS BANNER                */}
        {/* ========================================================================= */}
        <Card
          className={`border transition-all duration-200 overflow-hidden ${
            downCount > 0
              ? "border-rose-500/30 bg-rose-500/5"
              : degradedCount > 0
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-border/80 bg-card/70"
          }`}
        >
          <div className="p-5 sm:p-6 space-y-5">
            {/* Top row: Status indicator headline & action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`size-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    downCount > 0
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                      : degradedCount > 0
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  }`}
                >
                  {downCount > 0 ? (
                    <HugeiconsIcon icon={AlertCircleIcon} className="size-5 animate-pulse" />
                  ) : degradedCount > 0 ? (
                    <HugeiconsIcon icon={Activity01Icon} className="size-5" />
                  ) : (
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground font-heading">
                      {downCount > 0
                        ? "API Outage Detected"
                        : degradedCount > 0
                        ? "Degraded Service Performance"
                        : "All API Systems Operational"}
                    </h2>
                    <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">
                      • Updated {formatRelativeTime(data?.generatedAt)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {downCount > 0
                      ? `${downCount} of ${totalApis} APIs ${downCount > 1 ? "are" : "is"} currently unreachable or failing probe assertions.`
                      : degradedCount > 0
                      ? `${degradedCount} of ${totalApis} APIs ${degradedCount > 1 ? "are" : "is"} reporting elevated latency or partial error rates.`
                      : `All ${totalApis} monitored APIs are responding with optimal latency and passing health checks.`}
                  </p>
                </div>
              </div>

              {/* Direct contextual CTA */}
              <div className="flex items-center gap-2 shrink-0">
                {downCount > 0 || activeIncidentsCount > 0 ? (
                  <Link
                    to="/incidents"
                    className={buttonVariants({
                      variant: "destructive",
                      size: "sm",
                      className: "text-xs font-mono gap-1.5 h-8",
                    })}
                  >
                    <HugeiconsIcon icon={ShieldAlertIcon} className="size-3.5" />
                    <span>Triage Incidents ({activeIncidentsCount})</span>
                  </Link>
                ) : degradedCount > 0 ? (
                  <Link
                    to="/apis"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "text-xs font-mono gap-1.5 h-8 border-amber-500/30 text-amber-400",
                    })}
                  >
                    <span>Inspect Issues ({degradedCount})</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                  </Link>
                ) : (
                  <Link
                    to="/apis"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "text-xs font-mono gap-1.5 h-8",
                    })}
                  >
                    <span>View All APIs</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {/* Segmented Visual Proportion Bar */}
            <div className="space-y-2 pt-1">
              <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden flex">
                {healthyPct > 0 && (
                  <div
                    style={{ width: `${healthyPct}%` }}
                    className="h-full bg-emerald-500 transition-all duration-300"
                    title={`Healthy: ${healthyCount}`}
                  />
                )}
                {degradedPct > 0 && (
                  <div
                    style={{ width: `${degradedPct}%` }}
                    className="h-full bg-amber-500 transition-all duration-300"
                    title={`Degraded: ${degradedCount}`}
                  />
                )}
                {downPct > 0 && (
                  <div
                    style={{ width: `${downPct}%` }}
                    className="h-full bg-rose-500 transition-all duration-300"
                    title={`Down: ${downCount}`}
                  />
                )}
              </div>

              {/* Metric Breakdown Pills */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span className="font-semibold">{healthyCount}</span>
                  <span className="text-muted-foreground text-[11px]">Healthy</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] ${
                    degradedCount > 0
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${degradedCount > 0 ? "bg-amber-400" : "bg-muted-foreground/40"}`} />
                  <span className="font-semibold font-mono">{degradedCount}</span>
                  <span>Degraded</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] ${
                    downCount > 0
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-400 font-semibold"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${downCount > 0 ? "bg-rose-400 animate-ping" : "bg-muted-foreground/40"}`} />
                  <span className="font-semibold font-mono">{downCount}</span>
                  <span>Down</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] ${
                    activeIncidentsCount > 0
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-400 font-semibold"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <HugeiconsIcon icon={ShieldAlertIcon} className="size-3" />
                  <span className="font-semibold font-mono">{activeIncidentsCount}</span>
                  <span>Active {activeIncidentsCount === 1 ? "Incident" : "Incidents"}</span>
                </div>

                <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
                  {totalApis} Total Registered Services
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* 2. ACTIVE INCIDENT HIGHLIGHT BANNER (If any incident is active)           */}
        {/* ========================================================================= */}
        {activeIncident && (
          <div className="border border-rose-500/30 bg-rose-500/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <span className="size-2 rounded-full bg-rose-400 animate-ping shrink-0 mt-1" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-300 font-heading">
                    Active Incident: {activeIncident.apiName} ({activeIncident.environmentName})
                  </span>
                  <Badge variant="outline" className="border-rose-500/40 text-rose-300 text-[10px] font-mono">
                    {activeIncident.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  {activeIncident.reason || "Ongoing service degradation"} • Started {formatRelativeTime(activeIncident.startedAt)}
                </p>
              </div>
            </div>

            <Link
              to="/incidents"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs font-mono gap-1 shrink-0 h-7",
              })}
            >
              <span>View Triage</span>
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TWO-COLUMN WORKSPACE: APIS SERVICE FLEET & CONTEXTUAL HUB              */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ----------------------------------------------------------------------- */}
          {/* LEFT COLUMN: SERVICE FLEET & REQUIRING ATTENTION (8 cols)              */}
          {/* ----------------------------------------------------------------------- */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-border">
              {/* Header with search & filter */}
              <CardHeader className="p-4 sm:p-5 border-b border-border/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold font-heading">
                      Service Fleet Status
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Live operational state and health signals across registered services.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative w-40 sm:w-52">
                      <HugeiconsIcon
                        icon={Search01Icon}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
                      />
                      <Input
                        placeholder="Search services..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs font-mono"
                      />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => setActiveTab("ALL")}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          activeTab === "ALL"
                            ? "bg-background text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All ({totalApis})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("ISSUES")}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          activeTab === "ISSUES"
                            ? "bg-background text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Issues ({attentionApis.length})
                      </button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Service Rows */}
              <CardContent className="p-0 divide-y divide-border/60">
                {filteredApis.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6 text-muted-foreground/60 mx-auto" />
                    <div>
                      {activeTab === "ISSUES"
                        ? "No APIs currently experiencing issues. All systems healthy."
                        : "No APIs found matching your search."}
                    </div>
                  </div>
                ) : (
                  filteredApis.slice(0, 8).map((apiRow: ApiHealthTableRow) => {
                    const isIssue = apiRow.health !== "HEALTHY"
                    return (
                      <div
                        key={apiRow.apiId}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors group ${
                          isIssue ? "bg-muted/10" : ""
                        }`}
                      >
                        {/* API Info */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/apis/${apiRow.apiId}`}
                              className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate group-hover:underline"
                            >
                              {apiRow.apiName}
                            </Link>

                            {apiRow.service && (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                • {apiRow.service}
                              </span>
                            )}

                            <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                              {apiRow.environmentName || "production"}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {apiRow.healthReason ? (
                              <span className="truncate max-w-md text-foreground/80">
                                {apiRow.healthReason}
                              </span>
                            ) : (
                              <span>Passing health assertions</span>
                            )}
                            <span className="opacity-40">•</span>
                            <span>Checked {formatRelativeTime(apiRow.lastCheckedAt)}</span>
                          </div>
                        </div>

                        {/* Status Badge & Action */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          {renderHealthBadge(apiRow.health)}
                          <Link
                            to={`/apis/${apiRow.apiId}`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                              className: "h-7 px-2.5 text-xs font-mono text-muted-foreground hover:text-foreground gap-1",
                            })}
                          >
                            <span>Inspect</span>
                            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                          </Link>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>

              {/* Footer link to Fleet */}
              <div className="p-3.5 px-5 bg-muted/20 border-t border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>
                  Showing {Math.min(8, filteredApis.length)} of {totalApis} registered APIs
                </span>
                <Link
                  to="/apis"
                  className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <span>View all APIs</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                </Link>
              </div>
            </Card>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* RIGHT COLUMN: RECENT ACTIVITY & OBSERVABILITY HUB (4 cols)              */}
          {/* ----------------------------------------------------------------------- */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Recent Activity Feed */}
            <Card className="border-border">
              <CardHeader className="p-4 pb-3 border-b border-border/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold font-heading flex items-center gap-1.5">
                    <HugeiconsIcon icon={Clock01Icon} className="size-4 text-primary" />
                    <span>Recent Activity</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Incidents and schema contract updates
                  </CardDescription>
                </div>
                <Link to="/incidents" className="text-xs text-primary hover:underline font-mono text-[11px]">
                  History
                </Link>
              </CardHeader>

              <CardContent className="p-3 divide-y divide-border/60">
                {recentEvents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 text-emerald-400 mx-auto" />
                    <div>All quiet. No incidents or breaking schema mutations in the last 24h.</div>
                  </div>
                ) : (
                  recentEvents.map((evt) => (
                    <Link
                      key={evt.id}
                      to={evt.linkTo}
                      className="block py-2.5 px-1 hover:bg-muted/20 rounded transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                          {evt.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono px-1 py-0 uppercase shrink-0 ${
                            evt.badgeVariant === "rose"
                              ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
                              : evt.badgeVariant === "amber"
                              ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                              : evt.badgeVariant === "emerald"
                              ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                              : "border-blue-500/30 text-blue-400 bg-blue-500/10"
                          }`}
                        >
                          {evt.badgeText}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1">
                        {evt.subtitle}
                      </p>

                      <div className="text-[10px] font-mono text-muted-foreground/70">
                        {formatRelativeTime(evt.timestamp)}
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* 2. Observability & Detailed Navigation Hub */}
            <Card className="border-border">
              <CardHeader className="p-4 pb-3 border-b border-border/80">
                <CardTitle className="text-sm font-semibold font-heading">
                  Observability Hub
                </CardTitle>
                <CardDescription className="text-xs">
                  Direct navigation to detailed diagnostics
                </CardDescription>
              </CardHeader>

              <CardContent className="p-3 space-y-2">
                <Link
                  to="/analytics"
                  className="flex items-start justify-between p-2.5 rounded-lg hover:bg-muted/30 border border-transparent hover:border-border transition-all group"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      <HugeiconsIcon icon={ChartLineData01Icon} className="size-3.5 text-cyan-400" />
                      <span>Telemetry & Analytics</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Latency percentiles, error rates, and historical charts
                    </p>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </Link>

                <Link
                  to="/incidents"
                  className="flex items-start justify-between p-2.5 rounded-lg hover:bg-muted/30 border border-transparent hover:border-border transition-all group"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      <HugeiconsIcon icon={ShieldAlertIcon} className="size-3.5 text-rose-400" />
                      <span>Incident Command</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Outage triage, severity timelines, and correlation
                    </p>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </Link>

                <Link
                  to="/alert-rules"
                  className="flex items-start justify-between p-2.5 rounded-lg hover:bg-muted/30 border border-transparent hover:border-border transition-all group"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      <HugeiconsIcon icon={Notification01Icon} className="size-3.5 text-amber-400" />
                      <span>Alert Rules & Routing</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Trigger thresholds, email channels, and cooldowns
                    </p>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </Link>

                <Link
                  to="/contracts"
                  className="flex items-start justify-between p-2.5 rounded-lg hover:bg-muted/30 border border-transparent hover:border-border transition-all group"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      <HugeiconsIcon icon={FileCodeIcon} className="size-3.5 text-blue-400" />
                      <span>Contracts & Schemas</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Schema baseline comparison and payload drift
                    </p>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
