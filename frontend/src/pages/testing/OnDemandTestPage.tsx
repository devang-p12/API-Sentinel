import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  GripHorizontal,
  History,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

type AuthType = "none" | "bearer" | "basic" | "api-key";

interface RequestItem {
  id: number;
  key: string;
  value: string;
  enabled: boolean;
}

interface ResponseHeader {
  key: string;
  value: string;
}

interface TestResponse {
  status: number;
  statusText: string;
  time: number;
  size: string;
  body: string;
  headers: ResponseHeader[];
}

const METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-600",
  POST: "text-blue-600",
  PUT: "text-amber-600",
  PATCH: "text-violet-600",
  DELETE: "text-red-600",
  HEAD: "text-cyan-600",
  OPTIONS: "text-slate-600",
};

const EMPTY_ITEM = (): RequestItem => ({
  id: Date.now() + Math.random(),
  key: "",
  value: "",
  enabled: true,
});

const INITIAL_RESPONSE: TestResponse = {
  status: 0,
  statusText: "",
  time: 0,
  size: "0 Bytes",
  body: "",
  headers: [],
};

export const OnDemandTestPage: React.FC = () => {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");

  const [params, setParams] = useState<RequestItem[]>([
    EMPTY_ITEM(),
  ]);

  const [headers, setHeaders] = useState<RequestItem[]>([
    EMPTY_ITEM(),
  ]);

  const [body, setBody] = useState("");
  const [bodyType, setBodyType] = useState("json");

  const [authType, setAuthType] =
    useState<AuthType>("none");

  const [bearerToken, setBearerToken] = useState("");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");

  const [timeout, setTimeoutValue] = useState("5000");
  const [expectedStatus, setExpectedStatus] =
    useState("200");

  const [followRedirects, setFollowRedirects] =
    useState(true);

  const [verifySSL, setVerifySSL] = useState(true);

  const [requestTab, setRequestTab] = useState("params");
  const [responseTab, setResponseTab] =
    useState("body");

  const [response, setResponse] =
    useState<TestResponse>(INITIAL_RESPONSE);

  const [hasResponse, setHasResponse] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [responseHeight, setResponseHeight] =
    useState(48);

  const [isDragging, setIsDragging] =
    useState(false);

  const [prettyResponse, setPrettyResponse] =
    useState(true);

  const workspaceRef =
    useRef<HTMLDivElement>(null);

  const dragStartY = useRef(0);
  const dragStartHeight = useRef(48);

  /* ---------------------------------------------------------------------- */
  /* URL                                                                     */
  /* ---------------------------------------------------------------------- */

  const finalUrl = useMemo(() => {
    if (!url.trim()) return "";

    const activeParams = params.filter(
      (p) =>
        p.enabled &&
        p.key.trim()
    );

    if (!activeParams.length) {
      return url;
    }

    try {
      const parsed = new URL(url);

      activeParams.forEach((param) => {
        parsed.searchParams.set(
          param.key,
          param.value
        );
      });

      return parsed.toString();
    } catch {
      const query = activeParams
        .map(
          (p) =>
            `${encodeURIComponent(
              p.key
            )}=${encodeURIComponent(p.value)}`
        )
        .join("&");

      return url.includes("?")
        ? `${url}&${query}`
        : `${url}?${query}`;
    }
  }, [url, params]);

  /* ---------------------------------------------------------------------- */
  /* Request rows                                                            */
  /* ---------------------------------------------------------------------- */

  const updateItem = (
    setter: React.Dispatch<
      React.SetStateAction<RequestItem[]>
    >,
    id: number,
    field: keyof RequestItem,
    value: string | boolean
  ) => {
    setter((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const addItem = (
    setter: React.Dispatch<
      React.SetStateAction<RequestItem[]>
    >
  ) => {
    setter((items) => [
      ...items,
      EMPTY_ITEM(),
    ]);
  };

  const removeItem = (
    setter: React.Dispatch<
      React.SetStateAction<RequestItem[]>
    >,
    id: number
  ) => {
    setter((items) => {
      if (items.length === 1) {
        return [EMPTY_ITEM()];
      }

      return items.filter(
        (item) => item.id !== id
      );
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Send request                                                            */
  /* ---------------------------------------------------------------------- */

  const sendRequest = async () => {
    if (!url.trim() || isLoading) return;

    setIsLoading(true);
    setHasResponse(false);

    const credentials: Record<string, string> = {};

    if (authType === "bearer") {
      credentials.token = bearerToken;
    }

    if (authType === "basic") {
      credentials.username = basicUsername;
      credentials.password = basicPassword;
    }

    if (authType === "api-key") {
      credentials.key = apiKeyName;
      credentials.value = apiKeyValue;
    }

    try {
      const res = await fetch("/api/tests/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method,
          url,
          params,
          headers,
          body,
          bodyType,
          authType,
          credentials,
          timeout: Number(timeout),
          expectedStatus: Number(
            expectedStatus
          ),
          followRedirects,
          verifySSL,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const result = data.data;

        const responseBody =
          typeof result.data === "object"
            ? JSON.stringify(
                result.data,
                null,
                2
              )
            : String(result.data ?? "");

        setResponse({
          status: result.status,
          statusText:
            result.statusText || "",
          time: result.time ?? 0,
          size:
            result.size || "0 Bytes",
          body: responseBody,
          headers:
            result.headers || [],
        });

        setHasResponse(true);
      } else {
        setResponse({
          status: data.error?.status || 400,
          statusText:
            data.error?.message ||
            "Request Failed",
          time: 0,
          size: "0 Bytes",
          body: JSON.stringify(
            data.error,
            null,
            2
          ),
          headers: [],
        });

        setHasResponse(true);
      }
    } catch (error) {
      setResponse({
        status: 0,
        statusText: "Network Error",
        time: 0,
        size: "0 Bytes",
        body:
          error instanceof Error
            ? error.message
            : "Request failed",
        headers: [],
      });

      setHasResponse(true);
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Drag divider                                                            */
  /* ---------------------------------------------------------------------- */

  const startDragging = (
    event: React.PointerEvent
  ) => {
    event.preventDefault();

    setIsDragging(true);

    dragStartY.current =
      event.clientY;

    dragStartHeight.current =
      responseHeight;

    (
      event.currentTarget as HTMLElement
    ).setPointerCapture(event.pointerId);
  };

  const stopDragging = () => {
    setIsDragging(false);
  };

  const dragDivider = (
    event: React.PointerEvent
  ) => {
    if (!isDragging) return;

    const workspace =
      workspaceRef.current;

    if (!workspace) return;

    const delta =
      event.clientY -
      dragStartY.current;

    const height =
      workspace.clientHeight;

    const deltaPercent =
      (delta / height) * 100;

    const next =
      dragStartHeight.current -
      deltaPercent;

    setResponseHeight(
      Math.min(
        80,
        Math.max(25, next)
      )
    );
  };

  /* ---------------------------------------------------------------------- */
  /* Keyboard shortcut                                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        sendRequest();
      }
    };

    window.addEventListener(
      "keydown",
      handler
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handler
      );
    };
  });

  /* ---------------------------------------------------------------------- */
  /* Copy / download                                                        */
  /* ---------------------------------------------------------------------- */

  const copyResponse = async () => {
    await navigator.clipboard.writeText(
      response.body
    );
  };

  const downloadResponse = () => {
    const blob = new Blob(
      [response.body],
      {
        type: "application/json",
      }
    );

    const href =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = href;
    link.download =
      "api-sentinel-response.json";

    link.click();

    URL.revokeObjectURL(href);
  };

  const resetRequest = () => {
    setMethod("GET");
    setUrl("");
    setParams([EMPTY_ITEM()]);
    setHeaders([EMPTY_ITEM()]);
    setBody("");
    setAuthType("none");
    setBearerToken("");
    setBasicUsername("");
    setBasicPassword("");
    setApiKeyName("");
    setApiKeyValue("");
    setHasResponse(false);
    setResponse(INITIAL_RESPONSE);
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <TooltipProvider>
      <div
        ref={workspaceRef}
        className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
      >
        {/* ================================================================ */}
        {/* Page Header                                                        */}
        {/* ================================================================ */}

        <header className="flex h-14 shrink-0 items-center justify-between border-b px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
              <Send className="size-4" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">
                On-Demand Test
              </h1>

              <p className="truncate text-xs text-muted-foreground">
                Test any registered API endpoint.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                >
                  <History className="size-4" />
                </Button>
              </TooltipTrigger>

              <TooltipContent>
                Request history
              </TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 sm:flex"
            >
              <Save className="size-3.5" />
              Save
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={resetRequest}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Reset request
                </DropdownMenuItem>

                <DropdownMenuItem>
                  <Copy className="mr-2 size-4" />
                  Duplicate request
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 size-4" />
                  Clear
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ================================================================ */}
        {/* Request Bar                                                        */}
        {/* ================================================================ */}

        <section className="shrink-0 border-b bg-muted/10 p-3">
          <div className="flex gap-2">
            <Select
              value={method}
              onValueChange={(value) =>
                setMethod(
                  value as HttpMethod
                )
              }
            >
              <SelectTrigger className="h-10 w-[110px] shrink-0 bg-background font-mono text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {METHODS.map((item) => (
                  <SelectItem
                    key={item}
                    value={item}
                  >
                    <span
                      className={`font-mono font-semibold ${METHOD_COLORS[item]}`}
                    >
                      {item}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={url}
              onChange={(event) =>
                setUrl(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  sendRequest();
                }
              }}
              placeholder="https://api.example.com/v1/users"
              className="h-10 min-w-0 flex-1 bg-background font-mono text-xs"
            />

            <Button
              onClick={sendRequest}
              disabled={
                !url.trim() ||
                isLoading
              }
              className="h-10 shrink-0 gap-2 px-5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  <span className="hidden sm:inline">
                    Send
                  </span>
                </>
              )}
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {finalUrl ||
                  "No request URL"}
              </span>
            </div>

            <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">
              Ctrl + Enter to send
            </span>
          </div>
        </section>

        {/* ================================================================ */}
        {/* Workspace                                                          */}
        {/* ================================================================ */}

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            {/* ============================================================ */}
            {/* Request Panel                                                  */}
            {/* ============================================================ */}

            <section
              className="min-h-0 overflow-hidden"
              style={{
                height: `${100 - responseHeight}%`,
              }}
            >
              <Tabs
                value={requestTab}
                onValueChange={setRequestTab}
                className="flex h-full min-h-0 flex-col"
              >
                <div className="shrink-0 border-b px-3">
                  <TabsList className="h-10 rounded-none bg-transparent p-0">
                    <TabsTrigger
                      value="params"
                      className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                    >
                      Params
                    </TabsTrigger>

                    <TabsTrigger
                      value="authorization"
                      className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                    >
                      Auth
                      {authType !== "none" && (
                        <span className="ml-1.5 size-1.5 rounded-full bg-emerald-500" />
                      )}
                    </TabsTrigger>

                    <TabsTrigger
                      value="headers"
                      className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                    >
                      Headers
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px]">
                        {
                          headers.filter(
                            (h) =>
                              h.enabled &&
                              h.key.trim()
                          ).length
                        }
                      </span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="body"
                      className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                    >
                      Body
                    </TabsTrigger>

                    <TabsTrigger
                      value="settings"
                      className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                    >
                      Settings
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                  {/* Params */}
                  <TabsContent
                    value="params"
                    className="m-0 p-4"
                  >
                    <RequestTable
                      title="Query parameters"
                      type="params"
                      items={params}
                      onAdd={() =>
                        addItem(
                          setParams
                        )
                      }
                      onRemove={(id) =>
                        removeItem(
                          setParams,
                          id
                        )
                      }
                      onUpdate={(
                        id,
                        field,
                        value
                      ) =>
                        updateItem(
                          setParams,
                          id,
                          field,
                          value
                        )
                      }
                    />
                  </TabsContent>

                  {/* Auth */}
                  <TabsContent
                    value="authorization"
                    className="m-0 p-4"
                  >
                    <div className="max-w-2xl space-y-5">
                      <div className="space-y-2">
                        <Label>
                          Authorization
                        </Label>

                        <Select
                          value={authType}
                          onValueChange={(
                            value
                          ) =>
                            setAuthType(
                              value as AuthType
                            )
                          }
                        >
                          <SelectTrigger className="max-w-sm">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="none">
                              No Auth
                            </SelectItem>

                            <SelectItem value="bearer">
                              Bearer Token
                            </SelectItem>

                            <SelectItem value="basic">
                              Basic Auth
                            </SelectItem>

                            <SelectItem value="api-key">
                              API Key
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {authType ===
                        "bearer" && (
                        <div className="max-w-xl space-y-2">
                          <Label>
                            Token
                          </Label>

                          <Input
                            type="password"
                            value={
                              bearerToken
                            }
                            onChange={(
                              event
                            ) =>
                              setBearerToken(
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="Paste token here — without 'Bearer '"
                          />

                          <p className="text-[11px] text-muted-foreground">
                            API Sentinel will automatically
                            send{" "}
                            <code className="rounded bg-muted px-1">
                              Authorization:
                              Bearer &lt;token&gt;
                            </code>
                          </p>
                        </div>
                      )}

                      {authType ===
                        "basic" && (
                        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>
                              Username
                            </Label>

                            <Input
                              value={
                                basicUsername
                              }
                              onChange={(
                                event
                              ) =>
                                setBasicUsername(
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>
                              Password
                            </Label>

                            <Input
                              type="password"
                              value={
                                basicPassword
                              }
                              onChange={(
                                event
                              ) =>
                                setBasicPassword(
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </div>
                        </div>
                      )}

                      {authType ===
                        "api-key" && (
                        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>
                              Key
                            </Label>

                            <Input
                              value={
                                apiKeyName
                              }
                              onChange={(
                                event
                              ) =>
                                setApiKeyName(
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder="x-api-key"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>
                              Value
                            </Label>

                            <Input
                              type="password"
                              value={
                                apiKeyValue
                              }
                              onChange={(
                                event
                              ) =>
                                setApiKeyValue(
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder="API key"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Headers */}
                  <TabsContent
                    value="headers"
                    className="m-0 p-4"
                  >
                    <RequestTable
                      title="Request headers"
                      type="headers"
                      items={headers}
                      onAdd={() =>
                        addItem(
                          setHeaders
                        )
                      }
                      onRemove={(id) =>
                        removeItem(
                          setHeaders,
                          id
                        )
                      }
                      onUpdate={(
                        id,
                        field,
                        value
                      ) =>
                        updateItem(
                          setHeaders,
                          id,
                          field,
                          value
                        )
                      }
                    />
                  </TabsContent>

                  {/* Body */}
                  <TabsContent
                    value="body"
                    className="m-0 p-4"
                  >
                    <div className="max-w-4xl space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>
                          Request body
                        </Label>

                        <Select
                          value={bodyType}
                          onValueChange={
                            setBodyType
                          }
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="json">
                              JSON
                            </SelectItem>

                            <SelectItem value="text">
                              Text
                            </SelectItem>

                            <SelectItem value="xml">
                              XML
                            </SelectItem>

                            <SelectItem value="form">
                              Form Data
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="overflow-hidden rounded-lg border bg-muted/20">
                        <Textarea
                          value={body}
                          onChange={(
                            event
                          ) =>
                            setBody(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder={`{
  "name": "API Sentinel",
  "environment": "development"
}`}
                          className="min-h-[180px] resize-y rounded-none border-0 bg-transparent font-mono text-xs leading-6 shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Settings */}
                  <TabsContent
                    value="settings"
                    className="m-0 p-4"
                  >
                    <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Request timeout
                        </Label>

                        <div className="relative">
                          <Input
                            value={timeout}
                            onChange={(
                              event
                            ) =>
                              setTimeoutValue(
                                event
                                  .target
                                  .value
                              )
                            }
                            className="pr-12"
                          />

                          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                            ms
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Expected status
                        </Label>

                        <Input
                          value={
                            expectedStatus
                          }
                          onChange={(
                            event
                          ) =>
                            setExpectedStatus(
                              event
                                .target
                                .value
                            )
                          }
                        />
                      </div>

                      <SettingCheck
                        id="follow"
                        checked={
                          followRedirects
                        }
                        onChange={
                          setFollowRedirects
                        }
                        label="Follow redirects"
                      />

                      <SettingCheck
                        id="ssl"
                        checked={verifySSL}
                        onChange={
                          setVerifySSL
                        }
                        label="Verify SSL certificates"
                      />
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </section>

            {/* ============================================================ */}
            {/* Resize Handle                                                   */}
            {/* ============================================================ */}

            <div
              role="separator"
              aria-label="Resize request and response panels"
              aria-orientation="horizontal"
              className={`group relative z-10 h-2 shrink-0 cursor-row-resize border-y bg-muted/30 transition-colors hover:bg-muted ${
                isDragging
                  ? "bg-muted"
                  : ""
              }`}
              onPointerDown={
                startDragging
              }
              onPointerMove={
                dragDivider
              }
              onPointerUp={
                stopDragging
              }
              onPointerCancel={
                stopDragging
              }
            >
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <div className="rounded-full bg-border px-2 py-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                  <GripHorizontal className="size-3 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* Response Panel                                                  */}
            {/* ============================================================ */}

            <section
              className="min-h-0 overflow-hidden"
              style={{
                height: `${responseHeight}%`,
              }}
            >
              <div className="flex h-full min-h-0 flex-col">
                {/* Response header */}
                <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-xs font-semibold">
                      Response
                    </span>

                    {hasResponse && (
                      <>
                        <StatusBadge
                          status={
                            response.status
                          }
                          text={
                            response.statusText
                          }
                        />

                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock3 className="size-3" />
                          {response.time}
                          ms
                        </span>

                        <span className="hidden text-[11px] text-muted-foreground sm:block">
                          {response.size}
                        </span>
                      </>
                    )}
                  </div>

                  {hasResponse && (
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          asChild
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={
                              copyResponse
                            }
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </TooltipTrigger>

                        <TooltipContent>
                          Copy response
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          asChild
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={
                              downloadResponse
                            }
                          >
                            <Download className="size-3.5" />
                          </Button>
                        </TooltipTrigger>

                        <TooltipContent>
                          Download response
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {!hasResponse ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border bg-muted/30">
                        <Play className="size-4 text-muted-foreground" />
                      </div>

                      <p className="text-sm font-medium">
                        Ready to send
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Configure your request
                        and press Send.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Tabs
                    value={
                      responseTab
                    }
                    onValueChange={
                      setResponseTab
                    }
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <div className="shrink-0 border-b px-3">
                      <TabsList className="h-10 rounded-none bg-transparent p-0">
                        <TabsTrigger
                          value="body"
                          className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                        >
                          Body
                        </TabsTrigger>

                        <TabsTrigger
                          value="headers"
                          className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                        >
                          Headers
                          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px]">
                            {
                              response
                                .headers
                                .length
                            }
                          </span>
                        </TabsTrigger>

                        <TabsTrigger
                          value="cookies"
                          className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                        >
                          Cookies
                        </TabsTrigger>

                        <TabsTrigger
                          value="test"
                          className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent"
                        >
                          Test Results
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent
                      value="body"
                      className="m-0 min-h-0 flex-1 overflow-auto"
                    >
                      <div className="flex items-center justify-between border-b bg-muted/10 px-4 py-2">
                        <span className="text-[10px] text-muted-foreground">
                          Response body
                        </span>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() =>
                            setPrettyResponse(
                              !prettyResponse
                            )
                          }
                        >
                          {prettyResponse
                            ? "Raw"
                            : "Pretty"}
                        </Button>
                      </div>

                      <pre className="p-4 font-mono text-xs leading-6">
                        {prettyResponse
                          ? response.body
                          : response.body}
                      </pre>
                    </TabsContent>

                    <TabsContent
                      value="headers"
                      className="m-0 min-h-0 flex-1 overflow-auto p-4"
                    >
                      <div className="max-w-4xl overflow-hidden rounded-lg border">
                        {response
                          .headers
                          .length ? (
                          response.headers.map(
                            (
                              header
                            ) => (
                              <div
                                key={
                                  header.key
                                }
                                className="grid grid-cols-[180px_1fr] border-b last:border-0"
                              >
                                <div className="bg-muted/30 px-3 py-2 font-mono text-[11px]">
                                  {
                                    header.key
                                  }
                                </div>

                                <div className="break-all px-3 py-2 font-mono text-[11px] text-muted-foreground">
                                  {
                                    header.value
                                  }
                                </div>
                              </div>
                            )
                          )
                        ) : (
                          <div className="p-4 text-xs text-muted-foreground">
                            No response headers.
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="cookies"
                      className="m-0 p-4"
                    >
                      <div className="rounded-lg border p-4 text-xs text-muted-foreground">
                        No cookies returned.
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="test"
                      className="m-0 p-4"
                    >
                      <div className="flex max-w-xl items-center gap-3 rounded-lg border p-4">
                        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10">
                          <Check className="size-4 text-emerald-600" />
                        </div>

                        <div>
                          <p className="text-xs font-medium">
                            Request completed
                          </p>

                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            HTTP{" "}
                            {
                              response.status
                            }{" "}
                            received in{" "}
                            {
                              response.time
                            }
                            ms.
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

/* ========================================================================== */
/* Request Table                                                               */
/* ========================================================================== */

interface RequestTableProps {
  title: string;
  type: "params" | "headers";
  items: RequestItem[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (
    id: number,
    field: keyof RequestItem,
    value: string | boolean
  ) => void;
}

function RequestTable({
  title,
  type,
  items,
  onAdd,
  onRemove,
  onUpdate,
}: RequestTableProps) {
  return (
    <div className="max-w-5xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium">
            {title}
          </p>

          <p className="text-[10px] text-muted-foreground">
            Add, edit or disable individual{" "}
            {type}.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="grid grid-cols-[40px_1fr_1fr_40px] border-b bg-muted/30 text-[10px] font-medium text-muted-foreground">
          <div className="flex items-center justify-center">
            #
          </div>

          <div className="px-3 py-2">
            {type === "headers"
              ? "Header"
              : "Parameter"}
          </div>

          <div className="border-l px-3 py-2">
            Value
          </div>

          <div />
        </div>

        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[40px_1fr_1fr_40px] border-b last:border-0"
          >
            <div className="flex items-center justify-center">
              <Checkbox
                checked={
                  item.enabled
                }
                onCheckedChange={(
                  checked
                ) =>
                  onUpdate(
                    item.id,
                    "enabled",
                    checked === true
                  )
                }
              />
            </div>

            <div className="border-l">
              <Input
                value={item.key}
                onChange={(event) =>
                  onUpdate(
                    item.id,
                    "key",
                    event.target.value
                  )
                }
                placeholder={
                  type === "headers"
                    ? "Content-Type"
                    : "page"
                }
                className="h-9 rounded-none border-0 font-mono text-[11px] shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="border-l">
              <Input
                value={
                  item.value
                }
                onChange={(event) =>
                  onUpdate(
                    item.id,
                    "value",
                    event.target.value
                  )
                }
                placeholder={
                  type === "headers"
                    ? "application/json"
                    : "1"
                }
                className="h-9 rounded-none border-0 font-mono text-[11px] shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="flex items-center justify-center border-l">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onRemove(item.id)
                }
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Status Badge                                                               */
/* ========================================================================== */

function StatusBadge({
  status,
  text,
}: {
  status: number;
  text: string;
}) {
  const success =
    status >= 200 &&
    status < 300;

  const warning =
    status >= 300 &&
    status < 400;

  const failed =
    status >= 400 ||
    status === 0;

  const className = success
    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"
    : warning
      ? "border-amber-500/30 bg-amber-500/5 text-amber-600"
      : failed
        ? "border-red-500/30 bg-red-500/5 text-red-600"
        : "";

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 ${className}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          success
            ? "bg-emerald-500"
            : warning
              ? "bg-amber-500"
              : "bg-red-500"
        }`}
      />

      {status || "ERR"}{" "}
      {text}
    </Badge>
  );
}

/* ========================================================================== */
/* Settings Checkbox                                                          */
/* ========================================================================== */

function SettingCheck({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) =>
          onChange(value === true)
        }
      />

      <Label
        htmlFor={id}
        className="text-xs font-normal"
      >
        {label}
      </Label>
    </div>
  );
}