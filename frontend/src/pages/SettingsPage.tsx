import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function SettingsPage() {
  return (
    <PageContainer
      title="Settings"
      description="Organization configuration, worker engine defaults, and telemetry retention policies."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Settings" }]}
      action={
        <Button size="sm">
          <span>Save Configuration</span>
        </Button>
      }
    >
      <div className="space-y-6 max-w-4xl">
        {/* Organization Card */}
        <Card className="rounded-none border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Organization Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  Root tenant boundary for all projects, APIs, and alerts.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                Tier: Enterprise
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Organization Name</span>
                <div className="p-2 border border-border bg-muted/20 font-mono">
                  Acme Corp
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Tenant ID</span>
                <div className="p-2 border border-border bg-muted/20 font-mono text-muted-foreground">
                  org_sentinel_default_01
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Worker Engine Defaults */}
        <Card className="rounded-none border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Worker Engine Execution Parameters
            </CardTitle>
            <CardDescription className="text-xs">
              Default timeout constraints, retry budgets, and concurrency controls for BullMQ probe runners.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Default Timeout</span>
                <div className="p-2 border border-border bg-muted/20 font-mono">
                  5,000 ms
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Consecutive Threshold</span>
                <div className="p-2 border border-border bg-muted/20 font-mono">
                  3 Failures
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Telemetry Retention</span>
                <div className="p-2 border border-border bg-muted/20 font-mono">
                  90 Days
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
