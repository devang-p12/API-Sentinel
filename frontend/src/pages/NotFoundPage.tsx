import { Link } from "react-router-dom"
import { PageContainer } from "@/components/layout/PageContainer"
import { buttonVariants } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

export function NotFoundPage() {
  return (
    <PageContainer
      title="404 — Not Found"
      description="The requested page does not exist."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "404" }]}
    >
      <div className="py-24 text-center space-y-4">
        <p className="text-xs text-muted-foreground font-mono">
          The requested URL was not found on this platform.
        </p>
        <div>
          <Link
            to="/dashboard"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}
