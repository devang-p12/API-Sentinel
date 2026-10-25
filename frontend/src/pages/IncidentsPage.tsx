import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"

export function IncidentsPage() {
  return (
    <PageContainer
      title="Incidents"
      description="Automated failure detection, consecutive error thresholds, and outage lifecycle management."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Incidents" }]}
      action={
        <Badge
          variant="outline"
          className="text-xs h-6 gap-1.5 border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
        >
          <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>No Outages Detected</span>
        </Badge>
      }
    >
      <div className="space-y-6">
        <Card className="rounded-none border-border border-dashed bg-card/30">
          <CardContent className="py-16 px-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-6" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-heading font-semibold text-base text-foreground">
                All Monitored Services Healthy
              </h3>
              <p className="text-xs text-muted-foreground">
                When a probe fails consecutive threshold assertions (e.g. 3 consecutive network timeouts or 5xx errors), Sentinel automatically generates an incident and begins recovery tracking.
              </p>
            </div>
            <div className="pt-2">
              <Badge variant="secondary" className="text-xs font-mono">
                Threshold: 3 Consecutive Failures | Auto-Recovery: 2 Successes
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
