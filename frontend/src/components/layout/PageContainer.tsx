import type { ReactNode } from "react"
import { Link } from "react-router-dom"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageContainerProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  action?: ReactNode
  children: ReactNode
}

export function PageContainer({
  title,
  description,
  breadcrumbs,
  action,
  children,
}: PageContainerProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header section with optional breadcrumbs & action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div className="space-y-1">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 font-mono">
              {breadcrumbs.map((crumb, idx) => (
                <span key={crumb.label} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="opacity-40">/</span>}
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground font-heading">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>

      {/* Main page content */}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}
