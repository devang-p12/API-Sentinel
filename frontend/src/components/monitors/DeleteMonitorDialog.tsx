import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface DeleteMonitorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monitorName?: string
  monitorId?: string
  onConfirm: () => Promise<void>
}

export function DeleteMonitorDialog({
  open,
  onOpenChange,
  monitorName,
  monitorId,
  onConfirm,
}: DeleteMonitorDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Failed to delete monitor.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold text-destructive">
              Delete Monitor?
            </DialogTitle>
            <Badge variant="destructive" className="text-[10px] font-mono">
              Destructive
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            This action cannot be undone. All future probe executions scheduled for this monitor will be cancelled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {error && (
            <div className="p-2.5 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          <div className="p-3 bg-muted/40 border border-border">
            <p className="text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                "{monitorName || monitorId}"
              </span>
              ?
            </p>
            {monitorId && (
              <span className="text-[11px] font-mono text-muted-foreground block mt-1">
                ID: {monitorId}
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Monitor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
