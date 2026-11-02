import { useState, useEffect, type FormEvent } from "react"
import type { Api } from "@/lib/api"
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

interface EditApiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiItem: Api | null
  onSubmit: (data: {
    name: string
    description?: string
    service?: string
  }) => Promise<void>
}

export function EditApiDialog({
  open,
  onOpenChange,
  apiItem,
  onSubmit,
}: EditApiDialogProps) {
  const [name, setName] = useState("")
  const [service, setService] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (apiItem) {
      setName(apiItem.name || "")
      setService(apiItem.service || "")
      setDescription(apiItem.description || "")
    }
    setError(null)
  }, [apiItem, open])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("API Name is required.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        name: name.trim(),
        service: service.trim() || undefined,
        description: description.trim() || undefined,
      })
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Failed to update API.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Edit API Details</DialogTitle>
          <DialogDescription className="text-xs">
            Update API name, service application tag, and description.
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="text-xs"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Service / Application Identifier
            </label>
            <Input
              value={service}
              onChange={(e) => setService(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. payment-svc"
              className="text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground block">
              Unique slug or service identifier within this organization.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="text-xs"
            />
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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
