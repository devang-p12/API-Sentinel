import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "@/context/ApiContext";
import type { APIGroup, APIEnvironment, APIAuthType } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, CheckCircle2, Copy, KeyRound, Plus, RefreshCw, ShieldCheck } from "lucide-react";

type AuthMethod = "None" | "API Key" | "Bearer Token" | "OAuth 2.0";

const ENV_MAP: Record<string, APIEnvironment> = {
  development: "Development",
  staging: "Staging",
  production: "Production",
};

const AUTH_MAP: Record<string, APIAuthType> = {
  "api-key": "API Key",
  bearer: "Bearer Token",
  oauth2: "OAuth 2.0",
  none: "None",
};

export default function RegisterForm() {
  const navigate = useNavigate();
  const { addApi } = useApi();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    baseUrl: "",
    version: "v1",
    environment: "production",
    group: "Other" as APIGroup,
    authentication: "api-key",
  });

  const [scopes, setScopes] = useState({ read: true, write: false, delete: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = "API name is required";
    if (!formData.baseUrl.trim()) {
      errs.baseUrl = "Base URL is required";
    } else {
      try { new URL(formData.baseUrl); } catch { errs.baseUrl = "Must be a valid URL (https://...)"; }
    }
    return errs;
  };

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    addApi({
      name: formData.name.trim(),
      description: formData.description.trim(),
      version: formData.version,
      group: formData.group,
      baseUrl: formData.baseUrl.trim(),
      environment: ENV_MAP[formData.environment] ?? "Production",
      authType: AUTH_MAP[formData.authentication] ?? "None",
      healthEndpoint: "/health",
      healthMethod: "GET",
      healthEnabled: true,
      tags: [],
    });

    setSubmitted(true);
  };

  const resetForm = () => {
    setFormData({ name: "", description: "", baseUrl: "", version: "v1", environment: "production", group: "Other", authentication: "api-key" });
    setScopes({ read: true, write: false, delete: false });
    setErrors({});
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <Card className="w-full max-w-md text-center">
          <CardContent className="flex flex-col items-center gap-5 p-10">
            <div className="rounded-full bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">API Registered</h2>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{formData.name}</span> has been added to your API registry.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={resetForm}>Register Another</Button>
              <Button className="flex-1" onClick={() => navigate("/monitoring/dashboard")}>View Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const authLabel = formData.authentication === "api-key" ? "API Key"
    : formData.authentication === "oauth2" ? "OAuth 2.0" : "Bearer Token";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Left: Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Enter the details of your API endpoint.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Basic Information */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <p className="mt-1 text-xs text-muted-foreground">Identify your API and provide its endpoint.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Name */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">API Name</Label>
                <Input
                  id="name" name="name"
                  value={formData.name} onChange={handleChange}
                  placeholder="Payments API"
                  className={errors.name ? "border-red-500 focus-visible:ring-red-500/20" : ""}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="description" name="description"
                  value={formData.description} onChange={handleChange}
                  placeholder="Describe what this API does..."
                  rows={3} className="resize-none"
                />
              </div>

              {/* Base URL */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl" name="baseUrl"
                  value={formData.baseUrl} onChange={handleChange}
                  placeholder="https://api.example.com"
                  className={`font-mono text-sm ${errors.baseUrl ? "border-red-500 focus-visible:ring-red-500/20" : ""}`}
                />
                {errors.baseUrl && <p className="text-xs text-red-500">{errors.baseUrl}</p>}
              </div>

              {/* Version */}
              <div className="space-y-2">
                <Label>Version</Label>
                <Select value={formData.version} onValueChange={v => setFormData(p => ({ ...p, version: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1">v1</SelectItem>
                    <SelectItem value="v2">v2</SelectItem>
                    <SelectItem value="v3">v3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Environment */}
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={formData.environment} onValueChange={v => setFormData(p => ({ ...p, environment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Group */}
              <div className="space-y-2 sm:col-span-2">
                <Label>API Group</Label>
                <Select value={formData.group} onValueChange={v => setFormData(p => ({ ...p, group: v as APIGroup }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Payments">Payments</SelectItem>
                    <SelectItem value="Authentication">Authentication</SelectItem>
                    <SelectItem value="Users">Users</SelectItem>
                    <SelectItem value="Orders">Orders</SelectItem>
                    <SelectItem value="Notifications">Notifications</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* Authentication */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold">Authentication</h3>
              <p className="mt-1 text-xs text-muted-foreground">Select how clients will authenticate with your API.</p>
            </div>
            <div className="space-y-2">
              <Label>Authentication Method</Label>
              <Select value={formData.authentication} onValueChange={v => setFormData(p => ({ ...p, authentication: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="api-key">API Key</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          {/* Permissions */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold">API Permissions</h3>
              <p className="mt-1 text-xs text-muted-foreground">Choose what this API key can access.</p>
            </div>
            <div className="space-y-3">
              {([
                { id: "read", title: "Read", desc: "Allow reading API resources." },
                { id: "write", title: "Write", desc: "Allow creating and modifying resources." },
                { id: "delete", title: "Delete", desc: "Allow deleting resources." },
              ] as const).map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label htmlFor={p.id} className="cursor-pointer font-medium">{p.title}</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                  <Checkbox
                    id={p.id}
                    checked={scopes[p.id]}
                    onCheckedChange={c => setScopes(prev => ({ ...prev, [p.id]: c === true }))}
                  />
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => navigate("/monitoring/dashboard")}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              <Plus className="mr-1.5 h-4 w-4" /> Register API
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right Panel */}
      <div className="space-y-6">
        {/* Security tips */}
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">Secure Credentials</CardTitle>
            <CardDescription>Best practices for managing your API keys safely.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5 text-xs text-muted-foreground">
              {["Store credentials in environment variables", "Rotate keys regularly", "Never commit keys to Git", "Use the least-privilege scope"].map(tip => (
                <div key={tip} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                  {tip}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Registration summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "Name", value: formData.name || <span className="text-muted-foreground">—</span> },
              { label: "Version", value: formData.version },
              {
                label: "Environment",
                value: (
                  <Badge
                    variant="outline"
                    className={
                      formData.environment === "production"
                        ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                        : formData.environment === "staging"
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400"
                    }
                  >
                    {ENV_MAP[formData.environment]}
                  </Badge>
                ),
              },
              { label: "Auth", value: authLabel },
              { label: "Scopes", value: `${Object.values(scopes).filter(Boolean).length} selected` },
            ].map((row, i) => (
              <div key={i}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-right">{row.value}</span>
                </div>
                {i < 4 && <Separator className="mt-3" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* API Key placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Credentials</CardTitle>
            <CardDescription>Your key will be shown here after registration.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[100px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <KeyRound className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Register the API to generate credentials</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}