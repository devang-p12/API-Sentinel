import { useState, useEffect, type FormEvent } from "react"
import type { Project } from "@/lib/api"
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

interface CreateApiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  onCreate: (data: { name: string; description?: string; projectId: string }) => Promise<void>
}

export function CreateApiDialog({
  open,
  onOpenChange,
  projects,
  onCreate,
}: CreateApiDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState(projects[0]?.id || "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep projectId in sync if projects load asynchronously
  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id)
    }
  }, [projects, projectId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("API Name is required.")
      return
    }
    if (!projectId) {
      setError("Please select a target Project.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        projectId,
      })
      setName("")
      setDescription("")
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Target Project <span className="text-destructive">*</span>
            </label>
            {projects.length > 0 ? (
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
            ) : (
              <div className="text-xs text-muted-foreground border border-border p-2 bg-muted/20">
                No active projects found. Sentinel will link to default tenant project.
              </div>
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
              {isSubmitting ? "Registering..." : "Register API"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
