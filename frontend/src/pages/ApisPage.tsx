import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { api, type Api, type Project } from "@/lib/api"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ApiIcon,
  ArrowRight01Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons"
import { CreateApiDialog } from "@/components/apis/CreateApiDialog"

export function ApisPage() {
  const [apis, setApis] = useState<Api[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [apiList, projList] = await Promise.all([
        api.getApis(),
        api.getProjects(),
      ])
      setApis(apiList)
      setProjects(projList)
    } catch (err) {
      console.error("Failed to load APIs and Projects:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateApi = async (data: { name: string; description?: string; projectId: string }) => {
    await api.createApi(data)
    await loadData()
  }

  return (
    <PageContainer
      title="APIs & Services"
      description="Service catalog grouping monitored endpoints across Development, Staging, and Production environments."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "APIs" }]}
      action={
        <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          <span>Register API</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center text-xs text-muted-foreground border border-border bg-card/40">
            Loading registered services...
          </div>
        )}

        {/* Empty State Card (When no APIs are returned from PostgreSQL) */}
        {!isLoading && apis.length === 0 && (
          <Card className="rounded-none border-border border-dashed bg-card/30">
            <CardContent className="py-14 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <HugeiconsIcon icon={ApiIcon} className="size-6" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-heading font-semibold text-base text-foreground">
                  No APIs Registered Yet
                </h3>
                <p className="text-xs text-muted-foreground">
                  Register your internal microservices, external third-party dependencies, or gateway endpoints to establish environment-scoped reliability monitoring.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                  <span>Register Your First API</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Registered APIs Catalog Grid */}
        {!isLoading && apis.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apis.map((service) => {
              const envCount = service.environments?.length || 0
              const probeCount = service.environments?.reduce(
                (sum, env) => sum + (env.monitors?.length || 0),
                0
              ) || 0

              return (
                <Card key={service.id} className="rounded-none border-border bg-card flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded bg-primary/10 text-primary flex items-center justify-center">
                          <HugeiconsIcon icon={ApiIcon} className="size-3.5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                            {service.name}
                          </CardTitle>
                          <span className="text-[10px] text-muted-foreground font-mono block">
                            ID: {service.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {envCount} {envCount === 1 ? "Env" : "Envs"}
                      </Badge>
                    </div>

                    <CardDescription className="text-xs line-clamp-2 pt-2 text-muted-foreground">
                      {service.description || "No service description provided."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between text-xs border-t border-border/60 pt-2 text-muted-foreground">
                      <span>Linked Probes</span>
                      <span className="font-mono font-medium text-foreground">
                        {probeCount} {probeCount === 1 ? "Probe" : "Probes"}
                      </span>
                    </div>

                    <div className="pt-1">
                      <Link
                        to={`/apis/${service.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "xs",
                          className: "w-full justify-between gap-1",
                        })}
                      >
                        <span>View Environments & Probes</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* API Registration Modal Dialog */}
      <CreateApiDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        projects={projects}
        onCreate={handleCreateApi}
      />
    </PageContainer>
  )
}
