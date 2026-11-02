import { useState, useEffect, useCallback, useMemo } from "react"
import { Link } from "react-router-dom"
import { api, type Api, type Project, type EnvironmentType } from "@/lib/api"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ApiIcon,
  ArrowRight01Icon,
  Add01Icon,
  Folder01Icon,
  Search01Icon,
  Delete01Icon,
  GlobeIcon,
} from "@hugeicons/core-free-icons"
import { CreateApiDialog } from "@/components/apis/CreateApiDialog"
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog"

const TYPE_BADGE_STYLES: Record<EnvironmentType, string> = {
  DEVELOPMENT: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  UAT: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  STAGING: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  PRODUCTION: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  CUSTOM: "bg-slate-500/10 text-slate-400 border-slate-500/30",
}

export function ApisPage() {
  const [apis, setApis] = useState<Api[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateApiOpen, setIsCreateApiOpen] = useState(false)
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const handleCreateApi = async (data: {
    name: string
    description?: string
    service?: string
    projectId?: string
    environments?: Array<{
      name: string
      baseUrl: string
      type?: EnvironmentType
    }>
  }) => {
    await api.createApi(data)
    await loadData()
  }

  const handleDeleteApi = async (e: React.MouseEvent, apiId: string, apiName: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete "${apiName}" and all associated environments?`)) {
      return
    }
    setDeletingId(apiId)
    try {
      await api.deleteApi(apiId)
      await loadData()
    } catch (err: any) {
      alert(err?.message || "Failed to delete API")
    } finally {
      setDeletingId(null)
    }
  }

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev])
    setSelectedProjectId(newProject.id)
  }

  const filteredApis = useMemo(() => {
    return apis.filter((a) => {
      const matchesProject =
        selectedProjectId === "all" ||
        (selectedProjectId === "none" && !a.projectId) ||
        a.projectId === selectedProjectId

      if (!matchesProject) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        a.name.toLowerCase().includes(q) ||
        (a.service && a.service.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q))
      )
    })
  }, [apis, selectedProjectId, searchQuery])

  return (
    <PageContainer
      title="APIs & Services"
      description="Centralized SaaS API catalog managing microservices, application environments, and endpoint tiers."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "APIs" }]}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsCreateProjectOpen(true)}
          >
            <HugeiconsIcon icon={Folder01Icon} className="size-3.5" />
            <span>New Project</span>
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setIsCreateApiOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            <span>Register API</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search & Workspace Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <HugeiconsIcon
              icon={Search01Icon}
              className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by API name, service tag, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 h-8 rounded-none"
            />
          </div>

          {!isLoading && projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 p-1 border border-border bg-card/60">
              <span className="text-[11px] font-medium text-muted-foreground px-1.5 flex items-center gap-1">
                <HugeiconsIcon icon={Folder01Icon} className="size-3" />
                Project:
              </span>
              <button
                onClick={() => setSelectedProjectId("all")}
                className={`px-2 py-0.5 text-xs font-mono transition-colors ${
                  selectedProjectId === "all"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                All ({apis.length})
              </button>
              {projects.map((proj) => {
                const count = apis.filter((a) => a.projectId === proj.id).length
                const isSelected = selectedProjectId === proj.id
                return (
                  <button
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id)}
                    className={`px-2 py-0.5 text-xs font-mono transition-colors flex items-center gap-1 ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{proj.name}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center text-xs text-muted-foreground border border-border bg-card/40">
            Loading registered APIs and environments...
          </div>
        )}

        {/* Empty State Card (When no APIs exist at all) */}
        {!isLoading && apis.length === 0 && (
          <Card className="rounded-none border-border border-dashed bg-card/30">
            <CardContent className="py-14 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <HugeiconsIcon icon={ApiIcon} className="size-6" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-heading font-semibold text-base text-foreground">
                  No APIs Registered Yet
                </h3>
                <p className="text-xs text-muted-foreground">
                  Register your microservices, external third-party integrations, or core APIs to configure environments (Development, UAT, Staging, Production) and probe endpoints.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsCreateApiOpen(true)}
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                <span>Register Your First API</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filtered Empty State */}
        {!isLoading && apis.length > 0 && filteredApis.length === 0 && (
          <Card className="rounded-none border-border border-dashed bg-card/30">
            <CardContent className="py-10 px-6 flex flex-col items-center justify-center text-center space-y-3">
              <span className="text-xs text-muted-foreground">
                No APIs match your current search or project filter.
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedProjectId("all")
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Registered APIs Catalog Grid */}
        {!isLoading && filteredApis.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApis.map((service) => {
              const envCount = service.environments?.length || 0
              const probeCount =
                service.environments?.reduce(
                  (sum, env) => sum + (env.monitors?.length || 0),
                  0
                ) || 0

              const projectName =
                service.project?.name ||
                projects.find((p) => p.id === service.projectId)?.name

              return (
                <Card
                  key={service.id}
                  className="rounded-none border-border bg-card flex flex-col justify-between hover:border-border/90 transition-colors"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="size-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <HugeiconsIcon icon={ApiIcon} className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold tracking-tight text-foreground truncate">
                            {service.name}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {service.service && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono bg-muted/40 text-muted-foreground border-border/80 px-1.5 py-0"
                              >
                                svc: {service.service}
                              </Badge>
                            )}
                            {projectName && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono flex items-center gap-1 bg-muted/60 text-foreground px-1.5 py-0"
                              >
                                <HugeiconsIcon icon={Folder01Icon} className="size-2.5" />
                                <span>{projectName}</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                        title="Delete API"
                        disabled={deletingId === service.id}
                        onClick={(e) => handleDeleteApi(e, service.id, service.name)}
                      >
                        <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                      </Button>
                    </div>

                    <CardDescription className="text-xs line-clamp-2 pt-2 text-muted-foreground">
                      {service.description || "No service description provided."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    {/* Environments Tier Pills */}
                    <div className="border-t border-border/60 pt-2.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                        <span className="flex items-center gap-1">
                          <HugeiconsIcon icon={GlobeIcon} className="size-3" />
                          Environments ({envCount})
                        </span>
                        <span className="font-mono text-[10px]">
                          {probeCount} {probeCount === 1 ? "Probe" : "Probes"}
                        </span>
                      </div>

                      {service.environments && service.environments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {service.environments.map((env) => {
                            const badgeStyle =
                              TYPE_BADGE_STYLES[env.type || "DEVELOPMENT"]
                            return (
                              <Badge
                                key={env.id}
                                variant="outline"
                                className={`text-[10px] font-mono px-1.5 py-0 border ${badgeStyle}`}
                                title={`${env.name}: ${env.maskedBaseUrl || env.baseUrl}`}
                              >
                                {env.name} ({env.type || "DEV"})
                              </Badge>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          No environments configured yet
                        </span>
                      )}
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
                        <span>Manage Environments</span>
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
        open={isCreateApiOpen}
        onOpenChange={setIsCreateApiOpen}
        projects={projects}
        onCreate={handleCreateApi}
        onProjectCreated={handleProjectCreated}
      />

      {/* Project Creation Modal Dialog */}
      <CreateProjectDialog
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        onCreated={handleProjectCreated}
      />
    </PageContainer>
  )
}

