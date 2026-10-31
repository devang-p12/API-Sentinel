import { useState, useEffect, useCallback, useMemo } from "react"
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
  Folder01Icon,
} from "@hugeicons/core-free-icons"
import { CreateApiDialog } from "@/components/apis/CreateApiDialog"
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog"

export function ApisPage() {
  const [apis, setApis] = useState<Api[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateApiOpen, setIsCreateApiOpen] = useState(false)
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)

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

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev])
    setSelectedProjectId(newProject.id)
  }

  const filteredApis = useMemo(() => {
    if (selectedProjectId === "all") return apis
    return apis.filter((a) => a.projectId === selectedProjectId)
  }, [apis, selectedProjectId])

  return (
    <PageContainer
      title="APIs & Services"
      description="Service catalog grouping monitored endpoints across Development, Staging, and Production environments."
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
      <div className="space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center text-xs text-muted-foreground border border-border bg-card/40">
            Loading registered services and projects...
          </div>
        )}

        {/* Project Filter Tabs / Bar */}
        {!isLoading && projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 border border-border bg-card/60">
            <span className="text-[11px] font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
              <HugeiconsIcon icon={Folder01Icon} className="size-3" />
              Workspace:
            </span>
            <button
              onClick={() => setSelectedProjectId("all")}
              className={`px-2.5 py-1 text-xs font-mono transition-colors ${
                selectedProjectId === "all"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All Projects ({apis.length})
            </button>
            {projects.map((proj) => {
              const count = apis.filter((a) => a.projectId === proj.id).length
              const isSelected = selectedProjectId === proj.id
              return (
                <button
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`px-2.5 py-1 text-xs font-mono transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{proj.name}</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded-sm ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Empty State Card (When no APIs exist) */}
        {!isLoading && apis.length === 0 && (
          <Card className="rounded-none border-border border-dashed bg-card/30">
            <CardContent className="py-14 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <HugeiconsIcon icon={ApiIcon} className="size-6" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-heading font-semibold text-base text-foreground">
                  {projects.length === 0 ? "No Projects or APIs Registered" : "No APIs Registered Yet"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {projects.length === 0
                    ? "Start by creating your own Project workspace, then register your microservices or third-party APIs to monitor health and latency."
                    : "Register your internal microservices, external third-party dependencies, or gateway endpoints to establish environment-scoped reliability monitoring."}
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                {projects.length === 0 ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setIsCreateProjectOpen(true)}
                    >
                      <HugeiconsIcon icon={Folder01Icon} className="size-3.5" />
                      <span>Create Project</span>
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setIsCreateApiOpen(true)}
                    >
                      <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                      <span>Register API</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setIsCreateApiOpen(true)}
                  >
                    <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                    <span>Register Your First API</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtered Empty State (When APIs exist in other projects but none in selected project) */}
        {!isLoading && apis.length > 0 && filteredApis.length === 0 && (
          <Card className="rounded-none border-border border-dashed bg-card/30">
            <CardContent className="py-10 px-6 flex flex-col items-center justify-center text-center space-y-3">
              <span className="text-xs text-muted-foreground">
                No APIs registered in this project workspace yet.
              </span>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsCreateApiOpen(true)}
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                <span>Register API in this Project</span>
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
                projects.find((p) => p.id === service.projectId)?.name ||
                "Workspace"

              return (
                <Card
                  key={service.id}
                  className="rounded-none border-border bg-card flex flex-col justify-between"
                >
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
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ID: {service.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono flex items-center gap-1 bg-muted text-foreground"
                        >
                          <HugeiconsIcon icon={Folder01Icon} className="size-2.5" />
                          <span>{projectName}</span>
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {envCount} {envCount === 1 ? "Env" : "Envs"}
                        </Badge>
                      </div>
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
