import { useState, useEffect, type FormEvent } from "react"
import { api, type Api, type Environment, type Monitor } from "@/lib/api"
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
import { FileCodeIcon } from "@hugeicons/core-free-icons"
import { CurlImportModal } from "@/components/common/CurlImportModal"
import type { ParsedCurl } from "@/lib/curl-parser"

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const
type HttpMethodType = (typeof HTTP_METHODS)[number]

interface MonitorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monitor?: Monitor | null
  initialApiId?: string
  initialEnvironmentId?: string
  onSubmit: (data: {
    name: string
    description?: string
    environmentId: string
    method: HttpMethodType
    endpoint: string
    interval: number
    timeout: number
    expectedStatus: number
    enabled: boolean
    headers?: Record<string, string>
    body?: string
  }) => Promise<void>
}

export function MonitorFormDialog({
  open,
  onOpenChange,
  monitor,
  initialApiId,
  initialEnvironmentId,
  onSubmit,
}: MonitorFormDialogProps) {
  const isEditing = Boolean(monitor)

  const [apis, setApis] = useState<Api[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [isLoadingApis, setIsLoadingApis] = useState(false)

  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedApiId, setSelectedApiId] = useState("")
  const [selectedEnvId, setSelectedEnvId] = useState("")
  const [method, setMethod] = useState<HttpMethodType>("GET")
  const [endpoint, setEndpoint] = useState("/health")
  const [interval, setInterval] = useState("60")
  const [timeout, setTimeout] = useState("5")
  const [expectedStatus, setExpectedStatus] = useState("200")
  const [enabled, setEnabled] = useState(true)

  // Auth, Headers & Body states
  const [authType, setAuthType] = useState<"none" | "bearer" | "apiKey" | "custom">("none")
  const [bearerToken, setBearerToken] = useState("")
  const [apiKeyName, setApiKeyName] = useState("X-API-Key")
  const [apiKeyValue, setApiKeyValue] = useState("")
  const [customHeaders, setCustomHeaders] = useState("")
  const [requestBody, setRequestBody] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false)

  const handleImportCurl = (parsed: ParsedCurl) => {
    // 1. Method
    setMethod(parsed.method)

    // 2. Endpoint
    setEndpoint(parsed.endpoint || "/")

    // 3. Name (auto-suggest if empty or default)
    if (!name.trim()) {
      setName(`${parsed.suggestedName} Monitor`)
    }

    // 4. Try to match an existing environment by baseUrl
    if (parsed.baseUrl) {
      const matchedEnv = environments.find(
        (env) => env.baseUrl && env.baseUrl.replace(/\/+$/, "") === parsed.baseUrl.replace(/\/+$/, "")
      )
      if (matchedEnv) {
        setSelectedEnvId(matchedEnv.id)
      }
    }

    // 5. Auth & Headers
    const nonAuthHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed.headers)) {
      const lower = k.toLowerCase()
      if (lower === "authorization" || lower === "x-api-key" || lower === "api-key" || lower === "apikey") {
        continue
      }
      nonAuthHeaders[k] = v
    }

    if (parsed.authType === "bearer" && parsed.bearerToken) {
      setAuthType("bearer")
      setBearerToken(parsed.bearerToken)
      setShowAdvanced(true)
    } else if (parsed.authType === "apiKey" && parsed.apiKeyName && parsed.apiKeyValue) {
      setAuthType("apiKey")
      setApiKeyName(parsed.apiKeyName)
      setApiKeyValue(parsed.apiKeyValue)
      setShowAdvanced(true)
    } else if (Object.keys(nonAuthHeaders).length > 0) {
      setAuthType("custom")
      setCustomHeaders(JSON.stringify(nonAuthHeaders, null, 2))
      setShowAdvanced(true)
    }

    // 6. Request Body
    if (parsed.body) {
      setRequestBody(parsed.body)
      setShowAdvanced(true)
    }
  }

  // Fetch APIs and environments when dialog opens
  useEffect(() => {
    if (!open) return

    let isMounted = true
    setIsLoadingApis(true)
    setError(null)

    api
      .getApis()
      .then(async (fetchedApis) => {
        if (!isMounted) return
        setApis(fetchedApis)

        // Determine default or editing API
        let targetApiId = initialApiId || ""
        if (monitor?.environment?.apiId) {
          targetApiId = monitor.environment.apiId
        } else if (!targetApiId && fetchedApis.length > 0) {
          targetApiId = fetchedApis[0].id
        }

        setSelectedApiId(targetApiId)

        // Load environments for the chosen API
        if (targetApiId) {
          const envs = await api.getEnvironments(targetApiId)
          if (!isMounted) return
          setEnvironments(envs)

          if (monitor?.environmentId) {
            setSelectedEnvId(monitor.environmentId)
          } else if (initialEnvironmentId) {
            setSelectedEnvId(initialEnvironmentId)
          } else if (envs.length > 0) {
            setSelectedEnvId(envs[0].id)
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || "Failed to load APIs.")
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingApis(false)
      })

    return () => {
      isMounted = false
    }
  }, [open, monitor, initialApiId, initialEnvironmentId])

  // When API selection changes, update cascaded environment list
  const handleApiChange = async (apiId: string) => {
    setSelectedApiId(apiId)
    setSelectedEnvId("")
    setError(null)
    try {
      const envs = await api.getEnvironments(apiId)
      setEnvironments(envs)
      if (envs.length > 0) {
        setSelectedEnvId(envs[0].id)
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load environments for selected API.")
    }
  }

  // Populate or reset form fields based on monitor prop
  useEffect(() => {
    if (monitor) {
      setName(monitor.name)
      setDescription(monitor.description || "")
      setMethod(monitor.method as HttpMethodType)
      setEndpoint(monitor.url || "/health")
      setInterval(String(monitor.intervalSeconds || 60))
      setTimeout(String(Math.round((monitor.timeoutMs || 5000) / 1000)))
      setEnabled(monitor.isActive ?? true)
      setRequestBody(monitor.body || "")

      if (monitor.headers && Object.keys(monitor.headers).length > 0) {
        const authHeader = monitor.headers["Authorization"] || monitor.headers["authorization"]
        if (authHeader && authHeader.startsWith("Bearer ")) {
          setAuthType("bearer")
          setBearerToken(authHeader.replace("Bearer ", ""))
        } else if (monitor.headers["X-API-Key"] || monitor.headers["x-api-key"]) {
          setAuthType("apiKey")
          setApiKeyName("X-API-Key")
          setApiKeyValue(monitor.headers["X-API-Key"] || monitor.headers["x-api-key"] || "")
        } else {
          setAuthType("custom")
          setCustomHeaders(JSON.stringify(monitor.headers, null, 2))
        }
        setShowAdvanced(true)
      } else if (monitor.body) {
        setShowAdvanced(true)
      }

      // Find status code assertion
      const statusAssertion = monitor.assertions?.find(
        (a: any) => a.type === "statusCode" || a.type === "status"
      )
      setExpectedStatus(String(statusAssertion?.expected ?? 200))
    } else {
      setName("")
      setDescription("")
      setMethod("GET")
      setEndpoint("/health")
      setInterval("60")
      setTimeout("5")
      setExpectedStatus("200")
      setEnabled(true)
      setAuthType("none")
      setBearerToken("")
      setApiKeyName("X-API-Key")
      setApiKeyValue("")
      setCustomHeaders("")
      setRequestBody("")
      setShowAdvanced(false)
    }
  }, [monitor, open])

  // Resolve currently selected environment to display base URL preview
  const currentEnv = environments.find((e) => e.id === selectedEnvId)

  // Calculate composed URL preview
  const sanitizedEndpoint = endpoint.trim().startsWith("/")
    ? endpoint.trim()
    : `/${endpoint.trim()}`
  const composedUrlPreview = currentEnv?.baseUrl
    ? `${currentEnv.baseUrl.replace(/\/+$/, "")}${sanitizedEndpoint}`
    : `(Select environment)${sanitizedEndpoint}`

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Monitor Name is required.")
      return
    }

    if (!selectedEnvId) {
      setError("Please select an Environment. An API must have at least one environment before creating a monitor.")
      return
    }

    if (!sanitizedEndpoint) {
      setError("Endpoint path is required (e.g. /health).")
      return
    }

    const intervalNum = parseInt(interval, 10)
    if (isNaN(intervalNum) || intervalNum < 5) {
      setError("Interval must be at least 5 seconds.")
      return
    }

    const timeoutNum = parseInt(timeout, 10)
    if (isNaN(timeoutNum) || timeoutNum < 1) {
      setError("Timeout must be at least 1 second.")
      return
    }

    // Constraint: timeout < interval
    if (timeoutNum >= intervalNum) {
      setError(`Timeout (${timeoutNum}s) must be strictly less than Interval (${intervalNum}s).`)
      return
    }

    const statusNum = parseInt(expectedStatus, 10)
    if (isNaN(statusNum) || statusNum < 100 || statusNum > 599) {
      setError("Expected Status must be a valid HTTP status code between 100 and 599.")
      return
    }

    // Build headers & auth
    const finalHeaders: Record<string, string> = {}
    if (authType === "bearer" && bearerToken.trim()) {
      finalHeaders["Authorization"] = `Bearer ${bearerToken.trim()}`
    } else if (authType === "apiKey" && apiKeyName.trim() && apiKeyValue.trim()) {
      finalHeaders[apiKeyName.trim()] = apiKeyValue.trim()
    } else if (authType === "custom" && customHeaders.trim()) {
      try {
        const parsed = JSON.parse(customHeaders)
        if (typeof parsed === "object" && parsed !== null) {
          Object.assign(finalHeaders, parsed)
        }
      } catch {
        setError("Custom Headers must be a valid JSON object (e.g. {\"X-Header\": \"value\"}).")
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim() || undefined,
        environmentId: selectedEnvId,
        method,
        endpoint: sanitizedEndpoint,
        interval: intervalNum,
        timeout: timeoutNum,
        expectedStatus: statusNum,
        enabled,
        headers: Object.keys(finalHeaders).length > 0 ? finalHeaders : undefined,
        body: ["POST", "PUT", "PATCH"].includes(method) && requestBody.trim() ? requestBody.trim() : undefined,
      })
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Failed to save monitor.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold">
                {isEditing ? "Edit Monitor Configuration" : "Configure API Monitor"}
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                {method}
              </Badge>
            </div>
            {!isEditing && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setIsCurlModalOpen(true)}
                className="text-xs gap-1.5 font-mono shrink-0"
                title="Populate monitor from cURL command"
              >
                <HugeiconsIcon icon={FileCodeIcon} size={13} />
                Paste cURL
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update probe target endpoint, interval, timeout, and expected HTTP response."
              : "Define how Sentinel should check this API endpoint. Probing runs outside-in."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="p-2.5 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-foreground">
                Monitor Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Payment Health Check, Users API Check"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-foreground">Description</label>
              <Input
                placeholder="e.g. Validates that payment service responds within 5s with status 200"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="text-xs"
              />
            </div>
          </div>

          {/* Cascaded API -> Environment Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 border border-border">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Target API <span className="text-destructive">*</span>
              </label>
              <select
                value={selectedApiId}
                onChange={(e) => handleApiChange(e.target.value)}
                disabled={isSubmitting || isLoadingApis}
                className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono"
              >
                {apis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-muted-foreground block">
                Parent service definition.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Environment <span className="text-destructive">*</span>
              </label>
              {environments.length > 0 ? (
                <select
                  value={selectedEnvId}
                  onChange={(e) => setSelectedEnvId(e.target.value)}
                  disabled={isSubmitting || isLoadingApis}
                  className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono"
                >
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name} ({env.baseUrl || "no baseUrl"})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[11px] text-amber-500 border border-amber-500/20 bg-amber-500/10 p-2">
                  No environments found for this API. Add an environment first.
                </div>
              )}
              <span className="text-[10px] text-muted-foreground block">
                Stage where probe will execute.
              </span>
            </div>
          </div>

          {/* Request Config: Method & Endpoint */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Request Configuration <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethodType)}
                disabled={isSubmitting}
                className="w-28 h-8 px-2 text-xs font-mono font-bold bg-background border border-input rounded-none focus:outline-none focus:border-ring"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Input
                placeholder="/health or /api/v1/users"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                disabled={isSubmitting}
                className="text-xs font-mono flex-1"
              />
            </div>
            <div className="p-2 bg-muted/40 border border-border text-[11px] font-mono text-muted-foreground break-all">
              <span className="text-foreground font-semibold">Composed Request: </span>
              {method} {composedUrlPreview}
            </div>
          </div>

          {/* Parameters: Interval, Timeout, Expected Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Interval (seconds) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min="5"
                max="86400"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                disabled={isSubmitting}
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block">
                e.g. 60s (minimum 5s).
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Timeout (seconds) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min="1"
                max="60"
                value={timeout}
                onChange={(e) => setTimeout(e.target.value)}
                disabled={isSubmitting}
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block">
                Must be &lt; interval.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Expected HTTP Status <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min="100"
                max="599"
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(e.target.value)}
                disabled={isSubmitting}
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block">
                e.g. 200, 201, 204.
              </span>
            </div>
          </div>

          {/* Advanced Request Options: Authentication, Headers & Request Body */}
          <div className="border border-border bg-muted/10 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Authentication & Request Payload
              </span>
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="text-[11px] text-primary hover:underline font-mono"
              >
                {showAdvanced ? "Hide Options ▲" : "Show Options ▼"}
              </button>
            </div>

            {showAdvanced && (
              <div className="space-y-3 pt-1 border-t border-border">
                {/* Auth Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground block">
                    Authentication Type
                  </label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as any)}
                    disabled={isSubmitting}
                    className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono"
                  >
                    <option value="none">No Auth (Public Endpoint)</option>
                    <option value="bearer">Bearer Token (Authorization: Bearer ...)</option>
                    <option value="apiKey">API Key (Custom Header)</option>
                    <option value="custom">Custom Headers (Raw JSON)</option>
                  </select>
                </div>

                {/* Bearer Token Input */}
                {authType === "bearer" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      Bearer Token <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                      disabled={isSubmitting}
                      className="text-xs font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground block">
                      Automatically sent as `Authorization: Bearer &lt;token&gt;` with every probe.
                    </span>
                  </div>
                )}

                {/* API Key Inputs */}
                {authType === "apiKey" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">Header Name</label>
                      <Input
                        placeholder="X-API-Key"
                        value={apiKeyName}
                        onChange={(e) => setApiKeyName(e.target.value)}
                        disabled={isSubmitting}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">Header Value</label>
                      <Input
                        type="password"
                        placeholder="api_key_secret_..."
                        value={apiKeyValue}
                        onChange={(e) => setApiKeyValue(e.target.value)}
                        disabled={isSubmitting}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Custom Headers JSON */}
                {authType === "custom" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      Custom Headers (JSON)
                    </label>
                    <textarea
                      rows={3}
                      placeholder='{ "X-Tenant-ID": "tenant-123", "Accept": "application/json" }'
                      value={customHeaders}
                      onChange={(e) => setCustomHeaders(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full p-2 text-xs font-mono bg-background border border-input rounded-none focus:outline-none focus:border-ring resize-y"
                    />
                  </div>
                )}

                {/* Request Body (for POST, PUT, PATCH, or custom) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground block">
                      Request Body (Payload)
                    </label>
                    {["POST", "PUT", "PATCH"].includes(method) && (
                      <span className="text-[10px] text-primary font-mono uppercase">
                        Recommended for {method}
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    placeholder='{ "query": "{ health }", "action": "ping" }'
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full p-2 text-xs font-mono bg-background border border-input rounded-none focus:outline-none focus:border-ring resize-y"
                  />
                  <span className="text-[10px] text-muted-foreground block">
                    Sent as raw payload for stateful or write API health checks.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Enabled Switch */}
          <div className="flex items-center gap-2 p-2.5 bg-muted/20 border border-border">
            <input
              type="checkbox"
              id="monitor-enabled-checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={isSubmitting}
              className="size-4 accent-primary rounded-none cursor-pointer"
            />
            <label htmlFor="monitor-enabled-checkbox" className="text-xs font-medium text-foreground cursor-pointer select-none">
              Enable monitor immediately upon creation
            </label>
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
            <Button type="submit" size="sm" disabled={isSubmitting || environments.length === 0}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                ? "Save Changes"
                : "Create Monitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <CurlImportModal
        open={isCurlModalOpen}
        onOpenChange={setIsCurlModalOpen}
        title="Configure Monitor from cURL"
        description="Paste a cURL command. We'll automatically set the HTTP method, endpoint path, headers, auth token, and request body."
        onImport={handleImportCurl}
      />
    </Dialog>
  )
}
