import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { api, type CustomerDashboardSummary } from "@/lib/api"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  ApiIcon,
  AlertCircleIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"

export function DashboardPage() {
  const [summary, setSummary] = useState<CustomerDashboardSummary | null>(null)

  useEffect(() => {
    let isMounted = true
    api.getCustomerDashboardSummary()
      .then((data) => {
        if (isMounted) setSummary(data)
      })
      .catch(() => {
        // Fall back gracefully to initial empty stats
      })
    return () => {
      isMounted = false
    }
  }, [])

  const totalApis = summary?.kpis?.totalApis ?? 0
  const healthyApis = summary?.kpis?.healthy ?? 0
  const degradedApis = summary?.kpis?.degraded ?? 0
  const downApis = summary?.kpis?.down ?? 0
  const activeIncidents = summary?.kpis?.activeIncidents ?? 0
  const issuesCount = degradedApis + downApis

  return (
    <PageContainer
      title="System Overview"
      description="Live health, uptime SLA, and latency distribution across registered API services."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Overview" }]}
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/apis"
            className={buttonVariants({ size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={ApiIcon} className="size-3.5" />
            <span>Register API</span>
          </Link>
          <Link
            to="/monitors"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={Activity01Icon} className="size-3.5" />
            <span>Configure Monitor</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-none border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono tracking-wider">
                Total APIs
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono">
                {totalApis}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-[11px] text-muted-foreground">
                {totalApis > 0 ? `${totalApis} registered services` : "No registered services"}
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono tracking-wider">
                Healthy APIs
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-500">
                {healthyApis}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-[11px] text-muted-foreground">
                {totalApis > 0 ? "Passing all health probes" : "Awaiting health checks"}
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono tracking-wider">
                Issues / Degraded
              </CardDescription>
              <CardTitle className={`text-2xl font-bold font-mono ${issuesCount > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                {issuesCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-[11px] text-muted-foreground">
                {issuesCount > 0 ? `${downApis} down, ${degradedApis} degraded` : "No failing endpoints"}
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono tracking-wider">
                Active Incidents
              </CardDescription>
              <CardTitle className={`text-2xl font-bold font-mono ${activeIncidents > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {activeIncidents}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeIncidents > 0 ? (
                <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-500 bg-rose-500/10">
                  Requires attention
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                  All systems healthy
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Clean Initial / Welcome Banner */}
        <Card className="rounded-none border-border border-dashed bg-card/40">
          <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <HugeiconsIcon icon={Activity01Icon} className="size-6" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-heading font-semibold text-base text-foreground">
                Welcome to API Sentinel
              </h3>
              <p className="text-xs text-muted-foreground">
                Sentinel performs continuous outside-in health probing, contract drift detection, and percentile latency analytics for your APIs.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                to="/apis"
                className={buttonVariants({ size: "sm", className: "gap-1.5" })}
              >
                <span>Register First API Service</span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
              </Link>
              <Link
                to="/monitors"
                className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
              >
                <span>View Monitor Schedules</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-none border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={ApiIcon} className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Service Catalog</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Manage APIs across Development, Staging, and Production environments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/apis"
                className={buttonVariants({ variant: "ghost", size: "xs", className: "w-full justify-between" })}
              >
                <span>Go to APIs</span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Activity01Icon} className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Automated Probing</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Set recurring intervals, HTTP assertions, and timeout constraints.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/monitors"
                className={buttonVariants({ variant: "ghost", size: "xs", className: "w-full justify-between" })}
              >
                <span>Go to Monitors</span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Incident Lifecycle</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Consecutive failure tracking and automated outage escalation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/incidents"
                className={buttonVariants({ variant: "ghost", size: "xs", className: "w-full justify-between" })}
              >
                <span>Go to Incidents</span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
