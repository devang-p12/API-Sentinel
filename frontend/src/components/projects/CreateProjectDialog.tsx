import { useState, type FormEvent } from "react"
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

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (project: Project) => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Project Name is required.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const newProject = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      setName("")
      setDescription("")
      onCreated(newProject)
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Failed to create project. Check backend connectivity.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold">Create New Project</DialogTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              Workspace
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Projects act as top-level workspaces grouping your microservices, dashboards, and alert rules.
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
              Project Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Core Platform, Billing Engine, Auth Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="text-xs"
            />
            <span className="text-[10px] text-muted-foreground block">
              Unique name for this workspace.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description</label>
            <Input
              placeholder="e.g. Main production services and observability boundaries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
