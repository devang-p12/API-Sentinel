import { useState, useEffect, type FormEvent, useMemo } from "react"
import type { Environment, EnvironmentType } from "@/lib/api"
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
  onSubmit: (data: {
    name: string
    baseUrl: string
    type: EnvironmentType
    variables?: Record<string, any>
  }) => Promise<void>
}

const ENVIRONMENT_TYPES: Array<{
  value: EnvironmentType
  label: string
  desc: string
  color: string
}> = [
  {
    value: "DEVELOPMENT",
    label: "Development",
    desc: "Local or internal engineering clusters",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  {
    value: "UAT",
    label: "UAT",
    desc: "User acceptance and QA validation",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
  {
    value: "STAGING",
    label: "Staging",
    desc: "Pre-production mirror environment",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  {
    value: "PRODUCTION",
    label: "Production",
    desc: "Live customer-facing services",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  {
    value: "CUSTOM",
    label: "Custom",
    desc: "Ephemeral, demo, or multi-region target",
    color: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  },
]

export function EnvironmentFormDialog({
  open,
  onOpenChange,
  apiName,
  environment,
  onSubmit,
}: EnvironmentFormDialogProps) {
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [type, setType] = useState<EnvironmentType>("DEVELOPMENT")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = Boolean(environment)

  // Populate form fields on open or environment change
  useEffect(() => {
    if (environment) {
      setName(environment.name)
      setBaseUrl(environment.baseUrl || "")
      setType(environment.type || "DEVELOPMENT")
    } else {
      setName("")
      setBaseUrl("")
      setType("DEVELOPMENT")
    }
    setError(null)
  }, [environment, open])

  // Auto-infer type when typing environment name in create mode
  const handleNameChange = (val: string) => {
    setName(val)
    if (!isEditing) {
      const lower = val.toLowerCase()
      if (lower.includes("prod")) setType("PRODUCTION")
      else if (lower.includes("stag")) setType("STAGING")
      else if (lower.includes("uat")) setType("UAT")
      else if (lower.includes("dev") || lower.includes("local")) setType("DEVELOPMENT")
    }
  }

  // Real-time URL validation state
  const urlValidation = useMemo(() => {
    const trimmed = baseUrl.trim()
    if (!trimmed) return null
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          valid: false,
          message: "Only http:// and https:// protocols are supported",
        }
      }
      const normalized = trimmed.replace(/\/+$/, "")
      return {
        valid: true,
        normalized,
        hasTrailingSlash: trimmed.endsWith("/"),
      }
    } catch {
      return {
        valid: false,
        message: "Invalid URL format (e.g. https://api.example.com)",
      }
    }
  }, [baseUrl])

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

    if (!urlValidation?.valid) {
      setError(urlValidation?.message || "Please provide a valid HTTP/HTTPS URL.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        name: trimmedName,
        baseUrl: urlValidation.normalized || trimmedUrl,
        type,
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
              ? "Update environment name, deployment tier, and base URL."
              : "Specify an environment (e.g. Development, Staging, Production) and target base URL."}
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
              placeholder="e.g. Development, Production, Europe-Staging"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
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
              Environment Type / Tier <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ENVIRONMENT_TYPES.map((t) => {
                const isSelected = type === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    disabled={isSubmitting}
                    className={`text-left p-2 border transition-all text-xs rounded-none ${
                      isSelected
                        ? `${t.color} ring-1 ring-primary/40 font-semibold`
                        : "border-border/70 hover:border-border bg-card/60 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{t.label}</span>
                      {isSelected && <span className="text-[10px]">●</span>}
                    </div>
                    <span className="text-[9px] text-muted-foreground block line-clamp-1 mt-0.5">
                      {t.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Base URL <span className="text-destructive">*</span>
              </label>
              {urlValidation && (
                <span
                  className={`text-[10px] ${
                    urlValidation.valid ? "text-emerald-400" : "text-destructive"
                  }`}
                >
                  {urlValidation.valid ? "✓ Valid HTTP/HTTPS" : "✗ Invalid URL"}
                </span>
              )}
            </div>
            <Input
              placeholder="e.g. https://api.production.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={isSubmitting}
              className={`text-xs font-mono ${
                urlValidation && !urlValidation.valid
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Root URL for probes and API tester execution.</span>
              {urlValidation?.valid && urlValidation.hasTrailingSlash && (
                <span className="text-amber-400">Trailing slash will be trimmed</span>
              )}
            </div>
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

