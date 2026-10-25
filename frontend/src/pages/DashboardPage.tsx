import { Link } from "react-router-dom"
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
        {/* Metric Summary Cards — Real Empty/Initial States (No fake data) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-none border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono tracking-wider">
                Total Monitors
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono">0</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-[11px] text-muted-foreground">
                No active probe schedules
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono tracking-wider">
                Average Uptime (24h)
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-muted-foreground">
                --%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-[11px] text-muted-foreground">
                Awaiting telemetry samples
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono tracking-wider">
                p95 Latency
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-muted-foreground">
                -- ms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-[11px] text-muted-foreground">
                No outbound executions yet
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono tracking-wider">
                Active Incidents
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-500">
                0
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                All systems healthy
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Clean Initial / Empty State Banner */}
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
