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
} from "lucide-react";

export function RegisterForm() {
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);

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

    setApiKey(`sk_${formData.environment}_${randomPart}`);
    setCopied(false);
  };

  const copyApiKey = async () => {
    if (!apiKey) return;

    await navigator.clipboard.writeText(apiKey);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <Card className="border-black/10 shadow-none">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
            <KeyRound className="h-5 w-5" />
          </div>

          <div>
            <CardTitle>Register API</CardTitle>
            <CardDescription>
              Configure your API and generate credentials.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Basic Information */}
        <section className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold">
              Basic Information
            </h3>

            <p className="mt-1 text-xs text-black/50">
              Provide the basic details of your API.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">API Name</Label>

              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Payments API"
                className="border-black/20 focus-visible:ring-black"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">
                Description
              </Label>

              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe what this API does..."
                rows={4}
                className="resize-none border-black/20 focus-visible:ring-black"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="baseUrl">
                Base URL
              </Label>

              <Input
                id="baseUrl"
                name="baseUrl"
                value={formData.baseUrl}
                onChange={handleChange}
                placeholder="https://api.example.com"
                className="border-black/20 font-mono focus-visible:ring-black"
              />
            </div>

            <div className="space-y-2">
              <Label>API Version</Label>

              <Select
                value={formData.version}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    version: value,
                  }))
                }
              >
                <SelectTrigger className="border-black/20 focus:ring-black">
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
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    environment: value,
                  }))
                }
              >
                <SelectTrigger className="border-black/20 focus:ring-black">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="development">
                    Development
                  </SelectItem>

                  <SelectItem value="staging">
                    Staging
                  </SelectItem>

                  <SelectItem value="production">
                    Production
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <Separator className="bg-black/10" />

        {/* Authentication */}
        <section className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold">
              Authentication
            </h3>

            <p className="mt-1 text-xs text-black/50">
              Select how clients authenticate with your API.
            </p>
          </div>

          <Select
            value={formData.authentication}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                authentication: value,
              }))
            }
          >
            <SelectTrigger className="border-black/20 focus:ring-black">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="api-key">
                API Key
              </SelectItem>

              <SelectItem value="bearer">
                Bearer Token
              </SelectItem>

              <SelectItem value="oauth2">
                OAuth 2.0
              </SelectItem>
            </SelectContent>
          </Select>
        </section>

        <Separator className="bg-black/10" />

        {/* Permissions */}
        <section className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold">
              Permissions
            </h3>

            <p className="mt-1 text-xs text-black/50">
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
                className="flex items-center justify-between rounded-lg border border-black/10 p-4"
              >
                <div>
                  <Label
                    htmlFor={permission.id}
                    className="cursor-pointer font-medium"
                  >
                    {permission.title}
                  </Label>

                  <p className="mt-1 text-xs text-black/50">
                    {permission.description}
                  </p>
                </div>

                <Checkbox
                  id={permission.id}
                  checked={
                    scopes[
                    permission.id as keyof typeof scopes
                    ]
                  }
                  onCheckedChange={(checked) =>
                    setScopes((prev) => ({
                      ...prev,
                      [permission.id]: checked === true,
                    }))
                  }
                  className="border-black data-[state=checked]:bg-black data-[state=checked]:text-white"
                />
              </div>
            ))}
          </div>
        </section>

        <Separator className="bg-black/10" />

        {/* Generate API Key */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />

            <h3 className="text-sm font-semibold">
              API Credentials
            </h3>
          </div>

          {apiKey ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-black/10 bg-black/[0.03] p-4">
                <code className="break-all text-xs">
                  {apiKey}
                </code>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={copyApiKey}
                className="w-full border-black/20 hover:bg-black hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied
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
            <div className="rounded-lg border border-dashed border-black/15 p-8 text-center">
              <KeyRound className="mx-auto mb-2 h-5 w-5 text-black/30" />

              <p className="text-xs text-black/40">
                No API key generated yet.
              </p>
            </div>
          )}

          <Button
            type="button"
            onClick={generateApiKey}
            className="w-full bg-black text-white hover:bg-black/80"
          >
            <Plus className="mr-2 h-4 w-4" />
            {apiKey ? "Regenerate API Key" : "Register API"}
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}