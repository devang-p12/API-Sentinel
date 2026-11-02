import { useState, useEffect, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import { api, type Api, type Environment, type EnvironmentType } from "@/lib/api"
import { PageContainer } from "@/components/layout/PageContainer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ApiIcon,
  ArrowLeft01Icon,
  Add01Icon,
  Edit01Icon,
  Delete01Icon,
  FlashIcon,
  PlayIcon,
  Activity01Icon,
} from "@hugeicons/core-free-icons"
import { EnvironmentFormDialog } from "@/components/environments/EnvironmentFormDialog"
import { EditApiDialog } from "@/components/apis/EditApiDialog"

const TYPE_BADGE_STYLES: Record<string, string> = {
  DEVELOPMENT: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  UAT: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  STAGING: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  PRODUCTION: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  CUSTOM: "bg-slate-500/10 text-slate-400 border-slate-500/30",
}

export function ApiDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [service, setService] = useState<Api | null>(null)
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditApiOpen, setIsEditApiOpen] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [apiData, envsData] = await Promise.all([
        api.getApi(id),
        api.getApiEnvironments(id),
      ])
      setService(apiData)
      setEnvironments(envsData)
    } catch (err: any) {
      console.error("Failed to load API details or environments:", err)
      setError(err?.message || "Failed to load API details")
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenAdd = () => {
    setEditingEnv(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (env: Environment) => {
    setEditingEnv(env)
    setIsFormOpen(true)
  }

  const handleCreateOrUpdate = async (data: {
    name: string
    baseUrl: string
    type: EnvironmentType
    variables?: Record<string, any>
  }) => {
    if (!id) return
    if (editingEnv) {
      await api.updateEnvironment(editingEnv.id, data)
    } else {
      await api.createEnvironment(id, data)
    }
    await loadData()
  }

  const handleUpdateApi = async (data: {
    name: string
    description?: string
    service?: string
  }) => {
    if (!id) return
    await api.updateApi(id, data)
    await loadData()
  }

  const handleDelete = async (envId: string) => {
    if (!window.confirm("Are you sure you want to delete this environment?")) {
      return
    }
    setDeletingId(envId)
    try {
      await api.deleteEnvironment(envId)
      await loadData()
    } catch (err: any) {
      alert(err?.message || "Failed to delete environment")
    } finally {
      setDeletingId(null)
    }
  }

  const probeCount = environments.reduce(
    (sum, env) => sum + (env.monitors?.length || 0),
    0
  )

  return (
    <PageContainer
      title={service ? service.name : `API: ${id || "Unknown"}`}
      description={service?.description || "Service configuration, registered environments, and linked telemetry probes."}
      breadcrumbs={[
        { label: "Sentinel", href: "/dashboard" },
        { label: "APIs", href: "/apis" },
        { label: service?.name || id || "Detail" },
      ]}
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/apis"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
            <span>Back to APIs</span>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsEditApiOpen(true)}
          >
            <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
            <span>Edit API</span>
          </Button>
          <Link
            to={`/api-tester?apiId=${service?.id || id}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={PlayIcon} className="size-3.5 text-primary" />
            <span>Open in Tester</span>
          </Link>
          <Link
            to={`/load-tests/new?apiId=${service?.id || id}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <HugeiconsIcon icon={FlashIcon} className="size-3.5 text-amber-500" />
            <span>Load Test</span>
          </Link>
          <Button size="sm" className="gap-1.5" onClick={handleOpenAdd}>
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            <span>Add Environment</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="p-8 text-center text-xs text-muted-foreground border border-border bg-card/40">
            Loading service environments...
          </div>
        )}

        {!isLoading && service && (
          <>
            {/* API Identification Summary Card */}
            <Card className="rounded-none border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                      <HugeiconsIcon icon={ApiIcon} className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">{service.name}</CardTitle>
                        {service.service && (
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {service.service}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs font-mono">
                        UUID: {service.id}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {environments.length} {environments.length === 1 ? "Environment" : "Environments"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-muted/30 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Environments</span>
                    <span className="font-semibold text-foreground font-mono">
                      {environments.length} Configured
                    </span>
                  </div>
                  <div className="p-3 bg-muted/30 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Linked Probes</span>
                    <span className="font-semibold text-foreground font-mono">
                      {probeCount} Active Monitors
                    </span>
                  </div>
                  <div className="p-3 bg-muted/30 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Parent Project ID</span>
                    <span className="font-semibold text-foreground font-mono">
                      {service.projectId ? `${service.projectId.slice(0, 8)}...` : "Default"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Environments Management Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground font-heading">
                    {service.name} Environments
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Target deployment environments and base URLs for scheduled health checks.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpenAdd}>
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                  <span>Add Environment</span>
                </Button>
              </div>

              {/* Empty State */}
              {environments.length === 0 ? (
                <Card className="rounded-none border-border border-dashed bg-card/30">
                  <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <HugeiconsIcon icon={ApiIcon} className="size-5" />
                    </div>
                    <h3 className="font-heading font-semibold text-sm text-foreground">
                      No environments configured
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Add an environment to start monitoring this API.
                    </p>
                    <Button size="sm" className="mt-2 gap-1.5" onClick={handleOpenAdd}>
                      <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                      <span>Add Environment</span>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-none border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[180px] font-mono text-xs">Name</TableHead>
                        <TableHead className="w-[130px] font-mono text-xs">Environment Type</TableHead>
                        <TableHead className="font-mono text-xs">Base URL</TableHead>
                        <TableHead className="w-[120px] font-mono text-xs text-center">Probes</TableHead>
                        <TableHead className="w-[140px] font-mono text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {environments.map((env) => {
                        const typeStyle = env.type ? TYPE_BADGE_STYLES[env.type] : undefined
                        return (
                          <TableRow key={env.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                              <span className="font-medium text-foreground">{env.name}</span>
                            </TableCell>
                            <TableCell>
                              {env.type ? (
                                <Badge variant="outline" className={`text-[10px] ${typeStyle || ""}`}>
                                  {env.type}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs text-muted-foreground select-all">
                                {env.baseUrl || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Link
                                to={`/monitors?apiId=${service.id}`}
                                className="inline-flex items-center gap-1 hover:underline"
                              >
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  <HugeiconsIcon icon={Activity01Icon} className="size-3 mr-1 text-primary" />
                                  {env.monitors?.length || 0} Probes
                                </Badge>
                              </Link>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleOpenEdit(env)}
                                  className="h-6 px-2 gap-1 text-[11px]"
                                >
                                  <HugeiconsIcon icon={Edit01Icon} className="size-3" />
                                  <span>Edit</span>
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="xs"
                                  onClick={() => handleDelete(env.id)}
                                  disabled={deletingId === env.id}
                                  className="h-6 px-2 gap-1 text-[11px]"
                                >
                                  <HugeiconsIcon icon={Delete01Icon} className="size-3" />
                                  <span>{deletingId === env.id ? "..." : "Delete"}</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Environment Form Dialog */}
      <EnvironmentFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        apiName={service?.name}
        environment={editingEnv}
        onSubmit={handleCreateOrUpdate}
      />

      {/* Edit API Dialog */}
      <EditApiDialog
        open={isEditApiOpen}
        onOpenChange={setIsEditApiOpen}
        apiItem={service}
        onSubmit={handleUpdateApi}
      />
    </PageContainer>
  )
}
