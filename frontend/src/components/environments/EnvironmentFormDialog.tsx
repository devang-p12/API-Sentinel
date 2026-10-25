import { useState, useEffect, type FormEvent } from "react"
import type { Environment } from "@/lib/api"
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

interface EnvironmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiName?: string
  environment?: Environment | null
  onSubmit: (data: { name: string; baseUrl: string }) => Promise<void>
}

export function EnvironmentFormDialog({
  open,
  onOpenChange,
  apiName,
  environment,
  onSubmit,
}: EnvironmentFormDialogProps) {
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = Boolean(environment)

  // Populate form fields on open or environment change
  useEffect(() => {
    if (environment) {
      setName(environment.name)
      setBaseUrl(environment.baseUrl || "")
    } else {
      setName("")
      setBaseUrl("")
    }
    setError(null)
  }, [environment, open])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    const trimmedUrl = baseUrl.trim()

    if (!trimmedName) {
      setError("Environment name is required.")
      return
    }

    if (!trimmedUrl) {
      setError("Base URL is required.")
      return
    }

    // Client-side URL sanity check
    try {
      const parsed = new URL(trimmedUrl)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("Base URL must use http:// or https:// protocol.")
        return
      }
    } catch {
      setError("Base URL must be a valid URL (e.g. http://localhost:4000 or https://api.example.com).")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        name: trimmedName,
        baseUrl: trimmedUrl,
      })
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Failed to save environment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold">
              {isEditing ? "Edit Environment" : "Add Environment"}
            </DialogTitle>
            {apiName && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {apiName}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update environment name and base URL for this service."
              : "Specify an environment (e.g. Development, Testing, Production) and target base URL."}
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
              Environment Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Development, Testing, Production, UAT"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="text-xs"
            />
            <span className="text-[10px] text-muted-foreground block">
              Unique name for this API environment.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Base URL <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. http://localhost:4000 or https://api.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={isSubmitting}
              className="text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground block">
              The root URL where probes will execute against for this environment.
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
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                ? "Save Changes"
                : "Create Environment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
