import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
} from "lucide-react";
import { useApi } from "@/context/ApiContext";
import { useNavigate } from "react-router-dom";

export function RegisterForm() {
  const { refreshApis } = useApi();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    baseUrl: "",
    version: "v1",
    environment: "development",
    authentication: "api-key",
  });

  const [scopes, setScopes] = useState({
    read: true,
    write: false,
    delete: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const generateApiKey = () => {
    const randomPart = crypto.randomUUID().replace(/-/g, "");
    const generated = `sk_${formData.environment}_${randomPart}`;
    setApiKey(generated);
    setCopied(false);
    return generated;
  };

  const copyApiKey = async () => {
    if (!apiKey) return;

    await navigator.clipboard.writeText(apiKey);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleRegisterApi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage("API Name is required.");
      return;
    }

    if (!formData.baseUrl.trim()) {
      setErrorMessage("Base URL is required.");
      return;
    }

    // Ensure valid URL format
    try {
      new URL(formData.baseUrl);
    } catch {
      setErrorMessage("Please enter a valid URL (e.g., https://api.example.com)");
      return;
    }

    setIsSubmitting(true);

    try {
      const activeKey = apiKey || generateApiKey();

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        baseUrl: formData.baseUrl.trim(),
        version: formData.version,
        environment: formData.environment,
        authentication: formData.authentication,
        scopes,
        apiKey: activeKey,
        status: "Active",
      };

      const response = await fetch("/api/apis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to register API in database");
      }

      setSuccessMessage(`API "${formData.name}" successfully registered in PostgreSQL!`);
      
      // Refresh global state
      refreshApis();

      // Reset form
      setFormData({
        name: "",
        description: "",
        baseUrl: "",
        version: "v1",
        environment: "development",
        authentication: "api-key",
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect to backend server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-black/10 dark:border-white/10 shadow-none">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black dark:bg-white text-white dark:text-black shrink-0">
              <KeyRound className="h-5 w-5" />
            </div>

            <div>
              <CardTitle>Register API</CardTitle>
              <CardDescription>
                Configure your API and permanently store it in PostgreSQL.
              </CardDescription>
            </div>
          </div>

          {/* Quick Submit Button in Header */}
          <Button
            type="button"
            onClick={() => handleRegisterApi()}
            disabled={isSubmitting}
            className="bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/90 shrink-0"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit / Register API
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleRegisterApi} className="space-y-8">
          {/* Status Feedback */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate("/monitoring/dashboard")}
                className="text-xs border-green-600/30 hover:bg-green-500/20"
              >
                Go to Dashboard →
              </Button>
            </div>
          )}

          {/* Basic Information */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Provide the basic details of your API. (Press <strong>Enter</strong> in any field to submit).
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">API Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Payments API"
                  required
                  className="border-black/20 dark:border-white/20 focus-visible:ring-black dark:focus-visible:ring-white"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe what this API does..."
                  rows={4}
                  className="resize-none border-black/20 dark:border-white/20 focus-visible:ring-black dark:focus-visible:ring-white"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="baseUrl">Base URL *</Label>
                <Input
                  id="baseUrl"
                  name="baseUrl"
                  value={formData.baseUrl}
                  onChange={handleChange}
                  placeholder="https://api.example.com"
                  required
                  className="border-black/20 dark:border-white/20 font-mono focus-visible:ring-black dark:focus-visible:ring-white"
                />
              </div>

              <div className="space-y-2">
                <Label>API Version</Label>
                <Select
                  value={formData.version}
                  onValueChange={(value) => {
                    if (value) {
                      setFormData((prev) => ({
                        ...prev,
                        version: value,
                      }));
                    }
                  }}
                >
                  <SelectTrigger className="border-black/20 dark:border-white/20 focus:ring-black dark:focus:ring-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1">v1</SelectItem>
                    <SelectItem value="v2">v2</SelectItem>
                    <SelectItem value="v3">v3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Environment</Label>
                <Select
                  value={formData.environment}
                  onValueChange={(value) => {
                    if (value) {
                      setFormData((prev) => ({
                        ...prev,
                        environment: value,
                      }));
                    }
                  }}
                >
                  <SelectTrigger className="border-black/20 dark:border-white/20 focus:ring-black dark:focus:ring-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator className="bg-black/10 dark:bg-white/10" />

          {/* Authentication */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold">Authentication</h3>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Select how clients authenticate with your API.
              </p>
            </div>

            <Select
              value={formData.authentication}
              onValueChange={(value) => {
                if (value) {
                  setFormData((prev) => ({
                    ...prev,
                    authentication: value,
                  }));
                }
              }}
            >
              <SelectTrigger className="border-black/20 dark:border-white/20 focus:ring-black dark:focus:ring-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api-key">API Key</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                <SelectItem value="none">None (Public)</SelectItem>
              </SelectContent>
            </Select>
          </section>

          <Separator className="bg-black/10 dark:bg-white/10" />

          {/* Permissions */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold">Permissions</h3>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Select what this API key can access.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: "read",
                  title: "Read",
                  description: "Read API resources.",
                },
                {
                  id: "write",
                  title: "Write",
                  description: "Create and modify resources.",
                },
                {
                  id: "delete",
                  title: "Delete",
                  description: "Delete API resources.",
                },
              ].map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 p-4"
                >
                  <div>
                    <Label
                      htmlFor={permission.id}
                      className="cursor-pointer font-medium"
                    >
                      {permission.title}
                    </Label>
                    <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                      {permission.description}
                    </p>
                  </div>

                  <Checkbox
                    id={permission.id}
                    checked={scopes[permission.id as keyof typeof scopes]}
                    onCheckedChange={(checked) =>
                      setScopes((prev) => ({
                        ...prev,
                        [permission.id]: checked === true,
                      }))
                    }
                    className="border-black dark:border-white data-[state=checked]:bg-black dark:data-[state=checked]:bg-white data-[state=checked]:text-white dark:data-[state=checked]:text-black"
                  />
                </div>
              ))}
            </div>
          </section>

          <Separator className="bg-black/10 dark:bg-white/10" />

          {/* API Credentials */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <h3 className="text-sm font-semibold">API Credentials</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateApiKey}
                className="text-xs border-black/20 dark:border-white/20"
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                {apiKey ? "Regenerate Key" : "Generate Key"}
              </Button>
            </div>

            {apiKey ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4">
                  <code className="break-all text-xs font-mono">{apiKey}</code>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={copyApiKey}
                  className="w-full border-black/20 dark:border-white/20"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy API Key
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-black/15 dark:border-white/15 p-6 text-center">
                <KeyRound className="mx-auto mb-2 h-5 w-5 text-black/30 dark:text-white/30" />
                <p className="text-xs text-black/40 dark:text-white/40">
                  An API key will be automatically generated upon registration, or click "Generate Key" above.
                </p>
              </div>
            )}
          </section>

          <Separator className="bg-black/10 dark:bg-white/10" />

          {/* Submit Action */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 text-base bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Registering in PostgreSQL...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-5 w-5" />
                Register API (Submit)
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}