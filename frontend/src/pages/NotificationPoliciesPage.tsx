import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Notification01Icon,
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  Cancel01Icon,
  EyeIcon,
  FilterIcon,
} from "@hugeicons/core-free-icons"
import {
  api,
  type NotificationPolicy,
  type ContactPoint,
  type LabelMatcher,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const DEFAULT_OPERATORS: Array<LabelMatcher["operator"]> = ["=", "!=", "contains", "regex", "in"]

export function NotificationPoliciesPage() {
  const [policies, setPolicies] = useState<NotificationPolicy[]>([])
  const [contactPoints, setContactPoints] = useState<ContactPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<NotificationPolicy | null>(null)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formPriority, setFormPriority] = useState<number>(1)
  const [formMatchers, setFormMatchers] = useState<LabelMatcher[]>([])
  const [formContactPointIds, setFormContactPointIds] = useState<string[]>([])
  const [formNotifyOnFiring, setFormNotifyOnFiring] = useState(true)
  const [formNotifyOnRecovery, setFormNotifyOnRecovery] = useState(true)
  const [formRepeatInterval, setFormRepeatInterval] = useState<number>(0)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Live Matcher Preview state (Section 30)
  const [previewSample, setPreviewSample] = useState({
    severity: "CRITICAL",
    environment: "production",
    service: "payment-api",
  })
  const [previewResult, setPreviewResult] = useState<{ matched: boolean; breakdown: any[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [policiesData, pointsData] = await Promise.all([
        api.getNotificationPolicies(),
        api.getContactPoints(),
      ])
      setPolicies(policiesData)
      setContactPoints(pointsData)
    } catch (err: any) {
      console.error("Failed to load policies/points:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenCreate = () => {
    setEditingPolicy(null)
    setFormName("")
    setFormDescription("")
    setFormPriority(policies.length + 1)
    setFormMatchers([
      { label: "severity", operator: "=", value: "critical" },
      { label: "environment", operator: "=", value: "production" },
    ])
    setFormContactPointIds(contactPoints.slice(0, 1).map((cp) => cp.id))
    setFormNotifyOnFiring(true)
    setFormNotifyOnRecovery(true)
    setFormRepeatInterval(30)
    setFormError(null)
    setPreviewResult(null)
    setDrawerOpen(true)
  }

  const handleOpenEdit = (p: NotificationPolicy) => {
    setEditingPolicy(p)
    setFormName(p.name)
    setFormDescription(p.description || "")
    setFormPriority(p.priority)
    setFormMatchers(Array.isArray(p.matchers) ? p.matchers : [])
    setFormContactPointIds(Array.isArray(p.contactPointIds) ? p.contactPointIds : [])
    setFormNotifyOnFiring(p.notifyOnFiring)
    setFormNotifyOnRecovery(p.notifyOnRecovery)
    setFormRepeatInterval(p.repeatInterval || 0)
    setFormError(null)
    setPreviewResult(null)
    setDrawerOpen(true)
  }

  const handleAddMatcher = () => {
    setFormMatchers((prev) => [...prev, { label: "severity", operator: "=", value: "critical" }])
  }

  const handleUpdateMatcher = (index: number, field: keyof LabelMatcher, val: string) => {
    setFormMatchers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: val } : m)),
    )
  }

  const handleRemoveMatcher = (index: number) => {
    setFormMatchers((prev) => prev.filter((_, i) => i !== index))
  }

  const handleToggleContactPoint = (id: string) => {
    setFormContactPointIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleRunPreview = async () => {
    setPreviewLoading(true)
    try {
      const res = await api.previewNotificationPolicy(formMatchers, previewSample)
      setPreviewResult(res)
    } catch (err: any) {
      console.error("Preview failed:", err)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formName.trim()) {
      setFormError("Policy name is required")
      return
    }

    if (formContactPointIds.length === 0) {
      setFormError("At least one contact point must be selected")
      return
    }

    setFormSubmitting(true)
    try {
      if (editingPolicy) {
        await api.updateNotificationPolicy(editingPolicy.id, {
          name: formName,
          description: formDescription,
          priority: formPriority,
          matchers: formMatchers,
          contactPointIds: formContactPointIds,
          notifyOnFiring: formNotifyOnFiring,
          notifyOnRecovery: formNotifyOnRecovery,
          repeatInterval: Number(formRepeatInterval),
        })
      } else {
        await api.createNotificationPolicy({
          name: formName,
          description: formDescription,
          priority: formPriority,
          matchers: formMatchers,
          contactPointIds: formContactPointIds,
          notifyOnFiring: formNotifyOnFiring,
          notifyOnRecovery: formNotifyOnRecovery,
          repeatInterval: Number(formRepeatInterval),
        })
      }
      setDrawerOpen(false)
      loadData()
    } catch (err: any) {
      setFormError(err.message || "Failed to save notification policy")
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete policy "${name}"?`)) return
    try {
      await api.deleteNotificationPolicy(id)
      setPolicies((prev) => prev.filter((p) => p.id !== id))
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const handleToggleEnabled = async (p: NotificationPolicy) => {
    try {
      const updated = await api.updateNotificationPolicy(p.id, { isEnabled: !p.isEnabled })
      setPolicies((prev) => prev.map((item) => (item.id === p.id ? updated : item)))
    } catch (err: any) {
      alert(`Failed to toggle: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HugeiconsIcon icon={FilterIcon} className="w-6 h-6 text-primary" />
            Notification Policies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Route alerts and incidents to destinations based on label matchers, severity, and priority.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-2">
          <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
          New Policy
        </Button>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          Loading notification policies...
        </div>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl bg-card/30 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <HugeiconsIcon icon={Notification01Icon} className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Policies Configured</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            Notification policies evaluate incident labels and dispatch alerts to specified contact points.
          </p>
          <Button onClick={handleOpenCreate} className="gap-2">
            <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
            Create First Policy
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map((p) => {
            const matchers = Array.isArray(p.matchers) ? (p.matchers as LabelMatcher[]) : []
            const targetPoints = p.contactPoints || []

            return (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-all shadow-sm"
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-semibold border border-primary/20">
                        Priority {p.priority}
                      </span>
                      <h3 className="text-base font-bold text-foreground">{p.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.isEnabled
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.isEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>

                    {p.description && (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    )}

                    {/* Matchers list */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-muted-foreground font-medium">When:</span>
                      {matchers.length === 0 ? (
                        <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                          * (Catch-all)
                        </Badge>
                      ) : (
                        matchers.map((m, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-secondary border border-border font-mono"
                          >
                            <span className="text-primary font-medium">{m.label}</span>
                            <span className="text-muted-foreground">{m.operator}</span>
                            <span className="text-foreground font-semibold">{m.value}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Target Destinations */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:text-right">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Routes to:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {targetPoints.map((cp) => (
                          <Badge
                            key={cp.id}
                            variant="secondary"
                            className="text-xs flex items-center gap-1.5 font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {cp.name}
                            <span className="text-[10px] text-muted-foreground uppercase">
                              ({cp.type})
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Event Triggers */}
                    <div className="flex items-center gap-2 text-xs">
                      {p.notifyOnFiring && (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                          Firing
                        </span>
                      )}
                      {p.notifyOnRecovery && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          Recovery
                        </span>
                      )}
                      {p.repeatInterval > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                          Repeat {p.repeatInterval}m
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 border-t sm:border-t-0 sm:border-l border-border pt-2 sm:pt-0 sm:pl-3">
                      <button
                        onClick={() => handleToggleEnabled(p)}
                        className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground"
                      >
                        {p.isEnabled ? "Disable" : "Enable"}
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(p)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <HugeiconsIcon icon={Edit02Icon} className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(p.id, p.name)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div className="w-full max-w-xl bg-card border-l border-border h-full flex flex-col shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {editingPolicy ? "Edit Notification Policy" : "New Notification Policy"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Route incidents matching label conditions to specified contact points.
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

            <form onSubmit={handleSave} className="space-y-5 mt-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Policy Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Critical Production Incidents"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Priority (1 = highest)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formPriority}
                      onChange={(e) => setFormPriority(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of this routing rule..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Matcher Builder */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-foreground">
                      Label Matchers
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMatcher}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <HugeiconsIcon icon={Add01Icon} className="w-3.5 h-3.5" />
                      Add Rule
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Incidents must satisfy all matchers. Available labels: <code>severity</code>,{" "}
                    <code>environment</code>, <code>service</code>, <code>project</code>, plus alert labels.
                  </p>

                  <div className="space-y-2">
                    {formMatchers.map((m, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="label"
                          value={m.label}
                          onChange={(e) => handleUpdateMatcher(idx, "label", e.target.value)}
                          className="w-1/3 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background font-mono"
                        />
                        <select
                          value={m.operator}
                          onChange={(e) => handleUpdateMatcher(idx, "operator", e.target.value)}
                          className="w-24 px-2 py-1.5 text-xs rounded-lg border border-border bg-background font-mono"
                        >
                          {DEFAULT_OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="value"
                          value={m.value}
                          onChange={(e) => handleUpdateMatcher(idx, "value", e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveMatcher(idx)}
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target Contact Points Selection */}
                <div className="pt-2 border-t border-border">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Target Contact Points *
                  </label>
                  {contactPoints.length === 0 ? (
                    <div className="p-3 text-xs rounded-lg bg-muted text-muted-foreground">
                      No contact points created yet. Please create a contact point first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                      {contactPoints.map((cp) => {
                        const isChecked = formContactPointIds.includes(cp.id)
                        return (
                          <label
                            key={cp.id}
                            className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                              isChecked
                                ? "border-primary bg-primary/10 text-foreground font-medium"
                                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleContactPoint(cp.id)}
                              className="rounded border-border text-primary focus:ring-primary"
                            />
                            <div className="truncate">
                              <div>{cp.name}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">{cp.type}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Event Checkboxes & Repeat */}
                <div className="pt-2 border-t border-border space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formNotifyOnFiring}
                        onChange={(e) => setFormNotifyOnFiring(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">
                        Notify when Firing (Open)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formNotifyOnRecovery}
                        onChange={(e) => setFormNotifyOnRecovery(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">
                        Notify on Recovery (Resolved)
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Repeat Interval (minutes, 0 = no repeats)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={formRepeatInterval}
                      onChange={(e) => setFormRepeatInterval(parseInt(e.target.value, 10) || 0)}
                      className="w-32 px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Live Matcher Preview (Section 30) */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <HugeiconsIcon icon={EyeIcon} className="w-4 h-4 text-primary" />
                      Live Matching Preview
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleRunPreview}
                      disabled={previewLoading}
                      className="h-7 text-xs"
                    >
                      {previewLoading ? "Testing..." : "Test Matches"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground">severity</span>
                      <input
                        type="text"
                        value={previewSample.severity}
                        onChange={(e) =>
                          setPreviewSample((p) => ({ ...p, severity: e.target.value }))
                        }
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">environment</span>
                      <input
                        type="text"
                        value={previewSample.environment}
                        onChange={(e) =>
                          setPreviewSample((p) => ({ ...p, environment: e.target.value }))
                        }
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">service</span>
                      <input
                        type="text"
                        value={previewSample.service}
                        onChange={(e) =>
                          setPreviewSample((p) => ({ ...p, service: e.target.value }))
                        }
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background font-mono"
                      />
                    </div>
                  </div>

                  {previewResult && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        previewResult.matched
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold"
                          : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      <span>
                        {previewResult.matched
                          ? "✓ Match! This policy would dispatch notifications."
                          : "✕ No match. Conditions not satisfied."}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
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
                  {formSubmitting ? "Saving..." : editingPolicy ? "Update Policy" : "Save Policy"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
