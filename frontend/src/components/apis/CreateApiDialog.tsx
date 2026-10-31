import { useState, useEffect, type FormEvent } from "react"
import { api, type Project } from "@/lib/api"
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
import { Add01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"

interface CreateApiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  onCreate: (data: { name: string; description?: string; projectId: string }) => Promise<void>
  onProjectCreated?: (project: Project) => void
}

export function CreateApiDialog({
  open,
  onOpenChange,
  projects,
  onCreate,
  onProjectCreated,
}: CreateApiDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState(projects[0]?.id || "")
  const [isNewProjectMode, setIsNewProjectMode] = useState(projects.length === 0)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync mode and default projectId if projects change or modal opens
  useEffect(() => {
    if (open) {
      if (projects.length === 0) {
        setIsNewProjectMode(true)
        setProjectId("")
      } else {
        setIsNewProjectMode(false)
        if (!projectId || !projects.some((p) => p.id === projectId)) {
          setProjectId(projects[0].id)
        }
      }
    }
  }, [open, projects])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("API Name is required.")
      return
    }

    let targetProjectId = projectId

    if (isNewProjectMode) {
      if (!newProjectName.trim()) {
        setError("Project Name is required to create a new project.")
        return
      }
    } else {
      if (!targetProjectId) {
        setError("Please select a target Project.")
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (isNewProjectMode) {
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
        description: description.trim() || undefined,
        projectId: targetProjectId,
      })

      setName("")
      setDescription("")
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold">Register API Service</DialogTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              Core Service
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Add a service boundary to group Development, Staging, and Production environments for telemetry probing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="p-2.5 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          {/* Service Info */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              API Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Identity Service, Payments Gateway"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="text-xs"
            />
            <span className="text-[10px] text-muted-foreground block">
              Descriptive title of the service or microservice.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description</label>
            <Input
              placeholder="e.g. Handles JWT issuance and OAuth authentication flows"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="text-xs"
            />
          </div>

          {/* Target Project Section */}
          <div className="space-y-2 border-t border-border/70 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Target Project <span className="text-destructive">*</span>
              </label>
              {projects.length > 0 && (
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
              )}
            </div>

            {isNewProjectMode ? (
              <div className="space-y-2.5 p-3 border border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    Create New Project
                  </span>
                  {projects.length === 0 && (
                    <Badge variant="outline" className="text-[9px]">
                      Required
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">
                    Project Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Core Platform, Billing Engine"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs h-7"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Project Description (optional)</label>
                  <Input
                    placeholder="e.g. Production microservices workspace"
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs h-7"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  This project workspace will be created and linked to your new service.
                </span>
              </div>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isSubmitting}
                className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono"
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} ({proj.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
            )}

            <span className="text-[10px] text-muted-foreground block">
              APIs are strictly scoped to a parent Project in Sentinel's relational model.
            </span>
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
              {isSubmitting ? "Registering..." : isNewProjectMode ? "Create & Register API" : "Register API"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
