import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification01Icon } from "@hugeicons/core-free-icons"

export function AlertsPage() {
  return (
    <PageContainer
      title="Alerts & Notifications"
      description="Notification channels, webhooks, and threshold escalation policies for critical service events."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Alerts" }]}
      action={
        <Button size="sm" className="gap-1.5">
          <HugeiconsIcon icon={Notification01Icon} className="size-3.5" />
          <span>New Alert Policy</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="rounded-none border-border border-dashed bg-card/30">
          <CardContent className="py-16 px-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <HugeiconsIcon icon={Notification01Icon} className="size-6" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-heading font-semibold text-base text-foreground">
                No Alert Policies Configured
              </h3>
              <p className="text-xs text-muted-foreground">
                Connect external notification webhooks (Slack, PagerDuty, Email) to alert your engineering team when incidents are opened or resolved.
              </p>
            </div>
            <div className="pt-2">
              <Button size="sm" variant="outline">
                Configure Webhook Destination
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
