import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartLineData01Icon } from "@hugeicons/core-free-icons"

export function DashboardsPage() {
  return (
    <PageContainer
      title="Dashboards"
      description="Custom analytics views, percentile latency distributions (p50, p90, p95, p99), and SLA availability boards."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Dashboards" }]}
      action={
        <Button size="sm" className="gap-1.5">
          <HugeiconsIcon icon={ChartLineData01Icon} className="size-3.5" />
          <span>New Dashboard</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="rounded-none border-border border-dashed bg-card/30">
          <CardContent className="py-16 px-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <HugeiconsIcon icon={ChartLineData01Icon} className="size-6" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-heading font-semibold text-base text-foreground">
                No Custom Dashboards Yet
              </h3>
              <p className="text-xs text-muted-foreground">
                Build tailored analytics views combining multi-service availability trends, response times, and failure distribution metrics.
              </p>
            </div>
            <div className="pt-2">
              <Button size="sm" variant="outline">
                Create First Custom Board
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
