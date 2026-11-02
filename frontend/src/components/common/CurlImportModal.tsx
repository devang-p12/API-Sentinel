import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { parseCurlCommand, type ParsedCurl } from "@/lib/curl-parser"
import { HugeiconsIcon } from "@hugeicons/react"
import { FileCodeIcon } from "@hugeicons/core-free-icons"

interface CurlImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onImport: (parsed: ParsedCurl) => void
}

export function CurlImportModal({
  open,
  onOpenChange,
  title = "Import from cURL",
  description = "Paste a cURL command from your browser developer tools, Postman, or terminal to auto-fill the configuration.",
  onImport,
}: CurlImportModalProps) {
  const [curlText, setCurlText] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleParseAndImport = () => {
    setError(null)
    try {
      const parsed = parseCurlCommand(curlText)
      onImport(parsed)
      setCurlText("")
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Failed to parse cURL command")
    }
  }

  const handlePasteSample = () => {
    setCurlText(
      `curl -X POST 'https://api.example.com/v1/orders' \\\n  -H 'Authorization: Bearer secret-token' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"itemId": "xyz", "quantity": 1}'`
    )
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-none">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded bg-primary/10 text-primary flex items-center justify-center">
              <HugeiconsIcon icon={FileCodeIcon} size={16} />
            </div>
            <div>
              <DialogTitle className="font-heading text-sm">{title}</DialogTitle>
              <DialogDescription className="text-xs">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Textarea
            value={curlText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setCurlText(e.target.value)
              if (error) setError(null)
            }}
            placeholder={`curl -X POST 'https://api.example.com/v1/users' \\\n  -H 'Authorization: Bearer my-token' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name": "Devang"}'`}
            className="font-mono text-xs h-44 resize-none rounded-none bg-muted/30"
            autoFocus
          />

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Supports standard cURL flags: -X, -H, -d, --data, --url</span>
            <button
              type="button"
              onClick={handlePasteSample}
              className="text-primary hover:underline font-mono text-[11px]"
            >
              Insert Sample
            </button>
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 font-mono">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-none text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleParseAndImport}
            className="rounded-none font-medium text-xs"
          >
            Import & Auto-Fill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
