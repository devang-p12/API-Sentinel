import { useState, useEffect, useMemo, type FormEvent } from "react"
import { api, type Project, type EnvironmentType } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft01Icon,
  GlobeIcon,
  FileCodeIcon,
} from "@hugeicons/core-free-icons"
import { CurlImportModal } from "@/components/common/CurlImportModal"
import type { ParsedCurl } from "@/lib/curl-parser"

interface CreateApiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  onCreate: (data: {
    name: string
    description?: string
    service?: string
    projectId?: string
    environments?: Array<{
      name: string
      baseUrl: string
      type?: EnvironmentType
    }>
  }) => Promise<void>
  onProjectCreated?: (project: Project) => void
}

const INITIAL_ENV_TYPES: Array<{
  value: EnvironmentType
  label: string
}> = [
  { value: "DEVELOPMENT", label: "Development" },
  { value: "UAT", label: "UAT" },
  { value: "STAGING", label: "Staging" },
  { value: "PRODUCTION", label: "Production" },
  { value: "CUSTOM", label: "Custom" },
]

export function CreateApiDialog({
  open,
  onOpenChange,
  projects,
  onCreate,
  onProjectCreated,
}: CreateApiDialogProps) {
  const [name, setName] = useState("")
  const [service, setService] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState(projects[0]?.id || "")
  const [isNewProjectMode, setIsNewProjectMode] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  
  // Initial Environment state
  const [addInitialEnv, setAddInitialEnv] = useState(true)
  const [envName, setEnvName] = useState("Production")
  const [envBaseUrl, setEnvBaseUrl] = useState("")
  const [envType, setEnvType] = useState<EnvironmentType>("PRODUCTION")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false)

  const handleImportCurl = (parsed: ParsedCurl) => {
    if (parsed.baseUrl) {
      setEnvBaseUrl(parsed.baseUrl)
      setAddInitialEnv(true)
    }
    if (parsed.suggestedName) {
      setName(parsed.suggestedName)
      const slug = parsed.suggestedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      setService(slug)
    }
    if (parsed.endpoint && parsed.endpoint !== "/") {
      setDescription(`Imported from cURL (endpoint: ${parsed.endpoint})`)
    }
  }

  // Sync mode and default projectId if projects change or modal opens
  useEffect(() => {
    if (open) {
      if (projects.length > 0 && !projectId) {
        setProjectId(projects[0].id)
      }
    }
  }, [open, projects, projectId])

  // Auto-slugify service name when name changes if user hasn't typed a custom slug
  const handleNameChange = (val: string) => {
    setName(val)
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    setService(slug)
  }

  // URL validation for initial environment
  const urlValidation = useMemo(() => {
    if (!addInitialEnv || !envBaseUrl.trim()) return null
    const trimmed = envBaseUrl.trim()
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          valid: false,
          message: "Only http:// and https:// protocols are supported",
        }
      }
      return {
        valid: true,
        normalized: trimmed.replace(/\/+$/, ""),
      }
    } catch {
      return {
        valid: false,
        message: "Invalid URL format (e.g. https://api.example.com)",
      }
    }
  }, [addInitialEnv, envBaseUrl])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("API Name is required.")
      return
    }

    let targetProjectId = projectId || undefined

    if (isNewProjectMode) {
      if (!newProjectName.trim()) {
        setError("Project Name is required to create a new project.")
        return
      }
    }

    if (addInitialEnv) {
      if (!envName.trim()) {
        setError("Initial environment name is required.")
        return
      }
      if (!envBaseUrl.trim()) {
        setError("Initial environment base URL is required.")
        return
      }
      if (!urlValidation?.valid) {
        setError(urlValidation?.message || "Invalid environment base URL.")
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (isNewProjectMode && newProjectName.trim()) {
        const createdProject = await api.createProject({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || undefined,
        })
        targetProjectId = createdProject.id
        if (onProjectCreated) {
          onProjectCreated(createdProject)
        }
      }

      await onCreate({
        name: name.trim(),
        service: service.trim() || undefined,
        description: description.trim() || undefined,
        projectId: targetProjectId,
        environments: addInitialEnv
          ? [
              {
                name: envName.trim(),
                baseUrl: urlValidation?.normalized || envBaseUrl.trim(),
                type: envType,
              },
            ]
          : undefined,
      })

      setName("")
      setService("")
      setDescription("")
      setEnvBaseUrl("")
      setNewProjectName("")
      setNewProjectDescription("")
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Failed to register API. Check backend connectivity.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold">Register API Service</DialogTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                SaaS Model
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setIsCurlModalOpen(true)}
              className="text-xs gap-1.5 font-mono shrink-0"
              title="Import API from a cURL command"
            >
              <HugeiconsIcon icon={FileCodeIcon} size={13} />
              Paste cURL
            </Button>
          </div>
          <DialogDescription className="text-xs">
            Register a centralized API boundary with its application identifier and target environments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="p-2.5 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          {/* Service Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                API Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Identity Service, Payments Gateway"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                className="text-xs"
              />
              <span className="text-[10px] text-muted-foreground block">
                Human-readable name of the API.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Service / App Tag
              </label>
              <Input
                placeholder="e.g. identity-service"
                value={service}
                onChange={(e) => setService(e.target.value)}
                disabled={isSubmitting}
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block">
                Application identifier for cataloging.
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description</label>
            <Input
              placeholder="e.g. Handles JWT issuance, token rotation, and OAuth flows"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="text-xs"
            />
          </div>

          {/* Initial Environment Setup */}
          <div className="border border-border/70 p-3 bg-muted/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={GlobeIcon} className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Initial Environment
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={addInitialEnv}
                  onChange={(e) => setAddInitialEnv(e.target.checked)}
                  disabled={isSubmitting}
                  className="rounded-none border-input"
                />
                Create with API
              </label>
            </div>

            {addInitialEnv && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      Environment Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Production"
                      value={envName}
                      onChange={(e) => setEnvName(e.target.value)}
                      disabled={isSubmitting}
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Type / Tier</label>
                    <select
                      value={envType}
                      onChange={(e) => setEnvType(e.target.value as EnvironmentType)}
                      disabled={isSubmitting}
                      className="w-full h-7 px-2 text-xs bg-background border border-input rounded-none font-mono"
                    >
                      {INITIAL_ENV_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-muted-foreground">
                      Base URL <span className="text-destructive">*</span>
                    </label>
                    {urlValidation && (
                      <span
                        className={`text-[10px] ${
                          urlValidation.valid ? "text-emerald-400" : "text-destructive"
                        }`}
                      >
                        {urlValidation.valid ? "✓ Valid URL" : "✗ Invalid URL"}
                      </span>
                    )}
                  </div>
                  <Input
                    placeholder="https://api.example.com"
                    value={envBaseUrl}
                    onChange={(e) => setEnvBaseUrl(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs font-mono h-7"
                  />
                  <span className="text-[10px] text-muted-foreground block">
                    Must start with http:// or https://. Trailing slashes are cleaned automatically.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Optional Project Assignment */}
          <div className="space-y-2 border-t border-border/70 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Project Workspace (Optional)
              </label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 text-[11px] gap-1 px-1.5 text-primary hover:text-primary"
                onClick={() => setIsNewProjectMode(!isNewProjectMode)}
                disabled={isSubmitting}
              >
                {isNewProjectMode ? (
                  <>
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" />
                    Select Existing
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Add01Icon} className="size-3" />
                    New Project
                  </>
                )}
              </Button>
            </div>

            {isNewProjectMode ? (
              <div className="space-y-2 p-2.5 border border-border bg-muted/20">
                <Input
                  placeholder="New project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={isSubmitting}
                  className="text-xs h-7"
                />
              </div>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isSubmitting}
                className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono"
              >
                <option value="">No Project (Standalone SaaS API)</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Registering..." : "Register API"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <CurlImportModal
        open={isCurlModalOpen}
        onOpenChange={setIsCurlModalOpen}
        title="Register API from cURL"
        description="Paste any cURL command. We'll automatically extract the Base URL, API name, and service tag."
        onImport={handleImportCurl}
      />
    </Dialog>
  )
}

