import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Notification01Icon,
  Mail01Icon,
  Link01Icon,
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  PlayIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { api, type ContactPoint, type ContactPointType } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function ContactPointsPage() {
  const [contactPoints, setContactPoints] = useState<ContactPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingPoint, setEditingPoint] = useState<ContactPoint | null>(null)

  // Drawer form state
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState<ContactPointType>("SLACK")
  const [formConfig, setFormConfig] = useState<Record<string, any>>({
    webhookUrl: "",
    recipients: "",
    url: "",
    method: "POST",
    headersText: "",
  })
  const [formEnabled, setFormEnabled] = useState(true)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Test state
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  const loadPoints = async () => {
    setIsLoading(true)
    try {
      const data = await api.getContactPoints()
      setContactPoints(data)
    } catch (err: any) {
      console.error("Failed to load contact points:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPoints()
  }, [])

  const handleOpenCreate = () => {
    setEditingPoint(null)
    setFormName("")
    setFormType("SLACK")
    setFormConfig({
      webhookUrl: "",
      recipients: "",
      url: "",
      method: "POST",
      headersText: "",
    })
    setFormEnabled(true)
    setFormError(null)
    setDrawerOpen(true)
  }

  const handleOpenEdit = (cp: ContactPoint) => {
    setEditingPoint(cp)
    setFormName(cp.name)
    setFormType(cp.type)
    setFormEnabled(cp.isEnabled)
    setFormError(null)

    const cfg = cp.configuration || {}
    setFormConfig({
      webhookUrl: cfg.webhookUrl || "",
      recipients: Array.isArray(cfg.recipients) ? cfg.recipients.join(", ") : cfg.recipients || "",
      url: cfg.url || "",
      method: cfg.method || "POST",
      headersText: cfg.headers ? JSON.stringify(cfg.headers, null, 2) : "",
    })
    setDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formName.trim()) {
      setFormError("Contact point name is required")
      return
    }

    const builtConfig: Record<string, any> = {}

    if (formType === "EMAIL") {
      const recList = formConfig.recipients
        .split(",")
        .map((r: string) => r.trim())
        .filter(Boolean)
      if (recList.length === 0) {
        setFormError("At least one email recipient is required")
        return
      }
      builtConfig.recipients = recList
    } else if (formType === "SLACK") {
      if (!formConfig.webhookUrl?.trim()) {
        setFormError("Slack incoming webhook URL is required")
        return
      }
      builtConfig.webhookUrl = formConfig.webhookUrl.trim()
    } else if (formType === "WEBHOOK") {
      if (!formConfig.url?.trim()) {
        setFormError("Target Webhook URL is required")
        return
      }
      builtConfig.url = formConfig.url.trim()
      builtConfig.method = formConfig.method || "POST"
      if (formConfig.headersText?.trim()) {
        try {
          builtConfig.headers = JSON.parse(formConfig.headersText.trim())
        } catch {
          setFormError("Headers must be valid JSON format (e.g. {\"Authorization\": \"Bearer ...\"})")
          return
        }
      }
    }

    setFormSubmitting(true)
    try {
      if (editingPoint) {
        await api.updateContactPoint(editingPoint.id, {
          name: formName,
          type: formType,
          configuration: builtConfig,
          isEnabled: formEnabled,
        })
      } else {
        await api.createContactPoint({
          name: formName,
          type: formType,
          configuration: builtConfig,
          isEnabled: formEnabled,
        })
      }
      setDrawerOpen(false)
      loadPoints()
    } catch (err: any) {
      setFormError(err.message || "Failed to save contact point")
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete contact point "${name}"?`)) return
    try {
      await api.deleteContactPoint(id)
      setContactPoints((prev) => prev.filter((p) => p.id !== id))
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    setTestResult(null)
    try {
      const res = await api.testContactPoint(id)
      setTestResult({
        id,
        success: res.success,
        message: res.statusMessage || (res.success ? "Test sent successfully" : "Test failed"),
      })
    } catch (err: any) {
      setTestResult({
        id,
        success: false,
        message: err.message || "Failed to trigger test notification",
      })
    } finally {
      setTestingId(null)
    }
  }

  const handleToggle = async (cp: ContactPoint) => {
    try {
      const updated = await api.updateContactPoint(cp.id, { isEnabled: !cp.isEnabled })
      setContactPoints((prev) => prev.map((p) => (p.id === cp.id ? updated : p)))
    } catch (err: any) {
      alert(`Failed to toggle: ${err.message}`)
    }
  }

  const getChannelIcon = (type: ContactPointType) => {
    switch (type) {
      case "SLACK":
        return <HugeiconsIcon icon={Notification01Icon} className="w-4 h-4 text-emerald-400" />
      case "EMAIL":
        return <HugeiconsIcon icon={Mail01Icon} className="w-4 h-4 text-sky-400" />
      case "WEBHOOK":
        return <HugeiconsIcon icon={Link01Icon} className="w-4 h-4 text-purple-400" />
      default:
        return <HugeiconsIcon icon={Notification01Icon} className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HugeiconsIcon icon={Notification01Icon} className="w-6 h-6 text-primary" />
            Contact Points
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure notification destinations (Slack, Email, Webhooks) for alerts and incidents.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-2">
          <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
          New Contact Point
        </Button>
      </div>

      {/* Test Notification Banner if recently tested */}
      {testResult && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between ${
            testResult.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <div className="flex items-center gap-3">
            <HugeiconsIcon
              icon={testResult.success ? CheckmarkCircle02Icon : AlertCircleIcon}
              className="w-5 h-5 shrink-0"
            />
            <div className="text-sm font-medium">{testResult.message}</div>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-xs hover:underline text-muted-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          Loading contact points...
        </div>
      ) : contactPoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl bg-card/30 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <HugeiconsIcon icon={Notification01Icon} className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Contact Points Configured</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            Contact points specify where notifications should be routed when an incident is opened or resolved.
          </p>
          <Button onClick={handleOpenCreate} className="gap-2">
            <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
            Create First Contact Point
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contactPoints.map((cp) => {
            const isTesting = testingId === cp.id
            const cfg = cp.configuration || {}

            return (
              <div
                key={cp.id}
                className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between hover:border-border/80 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-secondary/80 border border-border">
                        {getChannelIcon(cp.type)}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground leading-snug">
                          {cp.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs font-mono uppercase tracking-wider">
                            {cp.type}
                          </Badge>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              cp.isEnabled
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {cp.isEnabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggle(cp)}
                      title={cp.isEnabled ? "Disable" : "Enable"}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {cp.isEnabled ? "Disable" : "Enable"}
                    </button>
                  </div>

                  {/* Destination Details */}
                  <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/50 text-xs font-mono text-muted-foreground break-all">
                    {cp.type === "EMAIL" && (
                      <div>
                        <span className="text-foreground font-medium font-sans">Recipients: </span>
                        {Array.isArray(cfg.recipients) ? cfg.recipients.join(", ") : cfg.recipients || "No recipients"}
                      </div>
                    )}
                    {cp.type === "SLACK" && (
                      <div>
                        <span className="text-foreground font-medium font-sans">Webhook: </span>
                        {cfg.webhookUrl || "••••••••"}
                      </div>
                    )}
                    {cp.type === "WEBHOOK" && (
                      <div className="space-y-1">
                        <div>
                          <span className="text-foreground font-medium font-sans">Endpoint: </span>
                          <span className="text-purple-400 font-semibold">{cfg.method || "POST"} </span>
                          {cfg.url || "••••••••"}
                        </div>
                        {cfg.headers && Object.keys(cfg.headers).length > 0 && (
                          <div className="text-[11px] text-muted-foreground/80">
                            Headers: {Object.keys(cfg.headers).join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(cp.id)}
                    disabled={isTesting || !cp.isEnabled}
                    className="gap-1.5 text-xs h-8"
                  >
                    <HugeiconsIcon icon={PlayIcon} className="w-3.5 h-3.5" />
                    {isTesting ? "Testing..." : "Test Dispatch"}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(cp)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <HugeiconsIcon icon={Edit02Icon} className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(cp.id, cp.name)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div className="w-full max-w-lg bg-card border-l border-border h-full flex flex-col shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {editingPoint ? "Edit Contact Point" : "New Contact Point"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set credentials and destination details. Sensitive tokens are encrypted at rest.
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 mt-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Contact Point Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Production Slack Alerts"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Channel Type *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["SLACK", "EMAIL", "WEBHOOK"] as ContactPointType[]).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setFormType(t)}
                        className={`p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition-all ${
                          formType === t
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border bg-card hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {getChannelIcon(t)}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Configuration Fields */}
                {formType === "EMAIL" && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Email Recipients *
                    </label>
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Comma-separated list of target email addresses.
                    </p>
                    <input
                      type="text"
                      required
                      placeholder="oncall@example.com, sre@example.com"
                      value={formConfig.recipients}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, recipients: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                )}

                {formType === "SLACK" && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Incoming Webhook URL *
                    </label>
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      From your Slack App incoming webhooks integration.
                    </p>
                    <input
                      type="url"
                      required
                      placeholder="https://hooks.slack.com/services/..."
                      value={formConfig.webhookUrl}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden font-mono"
                    />
                  </div>
                )}

                {formType === "WEBHOOK" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Endpoint URL *
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://api.pagerduty.com/v1/..."
                        value={formConfig.url}
                        onChange={(e) =>
                          setFormConfig((prev) => ({ ...prev, url: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          HTTP Method
                        </label>
                        <select
                          value={formConfig.method}
                          onChange={(e) =>
                            setFormConfig((prev) => ({ ...prev, method: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden"
                        >
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 cursor-pointer pb-2">
                          <input
                            type="checkbox"
                            checked={formEnabled}
                            onChange={(e) => setFormEnabled(e.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-xs font-medium text-foreground">Enabled</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Custom Headers (JSON)
                      </label>
                      <textarea
                        rows={3}
                        placeholder='{"Authorization": "Bearer secret_token"}'
                        value={formConfig.headersText}
                        onChange={(e) =>
                          setFormConfig((prev) => ({ ...prev, headersText: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Submit Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDrawerOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={formSubmitting}>
                  {formSubmitting ? "Saving..." : editingPoint ? "Update Point" : "Create Point"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
