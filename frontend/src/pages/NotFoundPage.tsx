import { Link } from "react-router-dom"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertDiamondIcon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"

export function NotFoundPage() {
  return (
    <PageContainer
      title="404 — Page Not Found"
      description="The requested route does not exist in Sentinel."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "404" }]}
    >
      <Card className="rounded-none border-border border-dashed bg-card/30">
        <CardContent className="py-16 px-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <HugeiconsIcon icon={AlertDiamondIcon} className="size-6" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="font-heading font-semibold text-base text-foreground">
              Route Not Found
            </h3>
            <p className="text-xs text-muted-foreground">
              The URL does not match any registered platform routes.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/dashboard"
              className={buttonVariants({ size: "sm", className: "gap-1.5" })}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
              <span>Return to Overview</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
