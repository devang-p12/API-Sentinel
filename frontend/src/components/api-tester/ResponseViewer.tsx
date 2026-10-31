import { useState, useMemo } from 'react';
import type { ApiExecutionResult } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Copy01Icon,
  CheckmarkCircle01Icon,
  Download01Icon,
  Search01Icon,
  AlertCircleIcon,
  Cancel01Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';

interface ResponseViewerProps {
  result: ApiExecutionResult | null;
  isExecuting: boolean;
}

export function ResponseViewer({ result, isExecuting }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'cookies' | 'timing' | 'tests'>('body');
  const [isRaw, setIsRaw] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Formatted JSON representation
  const prettyJson = useMemo(() => {
    if (!result) return '';
    if (typeof result.body === 'object' && result.body !== null) {
      return JSON.stringify(result.body, null, 2);
    }
    return result.rawBody || '';
  }, [result]);

  const handleCopy = () => {
    if (!result) return;
    const textToCopy = isRaw || typeof result.body !== 'object' ? result.rawBody : prettyJson;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([isRaw ? result.rawBody : prettyJson], {
      type: result.contentType || 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.${result.contentType.includes('json') ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: number | null) => {
    if (!status) {
      return (
        <Badge variant="destructive" className="font-mono text-xs font-semibold px-2">
          Network Error
        </Badge>
      );
    }
    if (status >= 200 && status < 300) {
      return (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-none border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
          {status} {result?.statusText || 'OK'}
        </span>
      );
    }
    if (status >= 300 && status < 400) {
      return (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-none border border-sky-500/30 bg-sky-500/10 text-sky-500">
          {status} {result?.statusText || 'Redirect'}
        </span>
      );
    }
    if (status >= 400 && status < 500) {
      return (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-none border border-amber-500/30 bg-amber-500/10 text-amber-500">
          {status} {result?.statusText || 'Client Error'}
        </span>
      );
    }
    return (
      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-none border border-rose-500/30 bg-rose-500/10 text-rose-500">
        {status} {result?.statusText || 'Server Error'}
      </span>
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (isExecuting) {
    return (
      <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 border border-border bg-card/20 space-y-3">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <div className="text-center space-y-1">
          <p className="font-mono text-xs font-semibold text-foreground">Executing API Request...</p>
          <p className="text-[11px] text-muted-foreground">Waiting for response from target server</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 border border-border border-dashed bg-card/10 text-center space-y-2">
        <p className="font-mono text-xs text-muted-foreground">
          Enter an API URL above and press <kbd className="px-1 py-0.5 bg-muted rounded border border-border text-foreground">Send</kbd> to inspect the response.
        </p>
      </div>
    );
  }

  const headerEntries = Object.entries(result.headers || {});
  const testResults = result.testResults || [];
  const testsPassed = result.testsSummary?.passed || 0;
  const testsTotal = result.testsSummary?.total || 0;

  return (
    <div className="border border-border flex flex-col h-full bg-card">
      {/* Top Response Status Bar */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
        {/* Status + Metrics */}
        <div className="flex flex-wrap items-center gap-3">
          {getStatusBadge(result.status)}

          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
            <span className="font-semibold text-foreground">{result.durationMs} ms</span>
          </div>

          <div className="text-xs font-mono text-muted-foreground">
            Size: <span className="font-semibold text-foreground">{formatSize(result.size)}</span>
          </div>

          {testsTotal > 0 && (
            <Badge
              variant="outline"
              className={`font-mono text-[10px] ${
                testsPassed === testsTotal
                  ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                  : 'border-rose-500/40 text-rose-500 bg-rose-500/10'
              }`}
            >
              Tests: {testsPassed}/{testsTotal} passed
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className="rounded-none gap-1 h-7 text-[11px]"
            title="Copy Response to clipboard"
          >
            {copied ? (
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3 text-emerald-500" />
            ) : (
              <HugeiconsIcon icon={Copy01Icon} className="size-3 text-muted-foreground" />
            )}
            <span className="hidden sm:inline">Copy</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleDownload}
            className="rounded-none gap-1 h-7 text-[11px]"
            title="Download Response"
          >
            <HugeiconsIcon icon={Download01Icon} className="size-3 text-muted-foreground" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </div>

      {/* Network Error Callout */}
      {result.error && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs font-mono flex items-start gap-2">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Execution Failure:</span>
            <p className="text-[11px] leading-relaxed break-all">{result.error}</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs Header */}
      <div className="border-b border-border bg-muted/10 flex items-center justify-between px-2">
        <div className="flex items-center">
          {(
            [
              { id: 'body', label: 'Body' },
              { id: 'headers', label: `Headers (${headerEntries.length})` },
              { id: 'cookies', label: `Cookies (${result.cookies?.length || 0})` },
              { id: 'timing', label: 'Timing' },
              { id: 'tests', label: `Tests (${testsTotal})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-mono border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-foreground font-semibold bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'body' && (
          <div className="flex items-center gap-2 py-1">
            {/* Search Input */}
            <div className="relative hidden sm:block">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search response..."
                className="h-6 text-[11px] font-mono w-40 pl-6 rounded-none bg-background"
              />
              <HugeiconsIcon
                icon={Search01Icon}
                className="size-3 text-muted-foreground absolute left-1.5 top-1/2 -translate-y-1/2"
              />
            </div>

            {/* Raw vs Pretty Toggle */}
            <div className="flex items-center border border-border">
              <button
                type="button"
                onClick={() => setIsRaw(false)}
                className={`px-2 py-0.5 text-[11px] font-mono ${
                  !isRaw ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pretty
              </button>
              <button
                type="button"
                onClick={() => setIsRaw(true)}
                className={`px-2 py-0.5 text-[11px] font-mono ${
                  isRaw ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Raw
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-auto min-h-[220px]">
        {/* Tab 1: Body */}
        {activeTab === 'body' && (
          <div className="p-3">
            {isRaw ? (
              <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-all select-all leading-relaxed bg-muted/20 p-3 border border-border">
                {result.rawBody || '(Empty Response Body)'}
              </pre>
            ) : (
              <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-all select-all leading-relaxed bg-muted/20 p-3 border border-border">
                {prettyJson || '(Empty Response Body)'}
              </pre>
            )}
          </div>
        )}

        {/* Tab 2: Headers */}
        {activeTab === 'headers' && (
          <div className="p-3">
            <div className="border border-border">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-muted-foreground text-[11px]">
                    <th className="px-3 py-1.5 text-left w-1/3">Key</th>
                    <th className="px-3 py-1.5 text-left">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {headerEntries.map(([k, v]) => (
                    <tr key={k} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-semibold text-foreground select-all">{k}</td>
                      <td className="px-3 py-1.5 text-muted-foreground select-all break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Cookies */}
        {activeTab === 'cookies' && (
          <div className="p-3">
            {!result.cookies || result.cookies.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono p-4 text-center">
                No Set-Cookie headers were returned with this response.
              </p>
            ) : (
              <div className="border border-border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-muted-foreground text-[11px]">
                      <th className="px-3 py-1.5 text-left">Name</th>
                      <th className="px-3 py-1.5 text-left">Value</th>
                      <th className="px-3 py-1.5 text-left">Domain</th>
                      <th className="px-3 py-1.5 text-left">Path</th>
                      <th className="px-3 py-1.5 text-left">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {result.cookies.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-1.5 font-semibold text-foreground">{c.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground select-all break-all">{c.value}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{c.domain || '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{c.path || '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{c.expires || 'Session'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Timing */}
        {activeTab === 'timing' && (
          <div className="p-4 space-y-4 max-w-lg">
            <div className="space-y-2">
              <span className="text-xs font-mono font-semibold text-foreground">
                Total Request Duration: {result.durationMs} ms
              </span>
              <div className="w-full h-4 bg-muted flex border border-border overflow-hidden">
                <div
                  style={{
                    width: `${Math.max(5, Math.min(100, (result.timing?.ttfbMs || 50) / (result.durationMs || 1) * 100))}%`,
                  }}
                  className="bg-sky-500 h-full"
                  title={`TTFB: ${result.timing?.ttfbMs || 0} ms`}
                />
                <div
                  style={{
                    width: `${Math.max(5, Math.min(100, (result.timing?.downloadMs || 10) / (result.durationMs || 1) * 100))}%`,
                  }}
                  className="bg-emerald-500 h-full"
                  title={`Download: ${result.timing?.downloadMs || 0} ms`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 border border-border bg-muted/20 space-y-1">
                <span className="text-muted-foreground block text-[11px]">Time to First Byte (TTFB)</span>
                <span className="font-semibold text-foreground">{result.timing?.ttfbMs || result.durationMs} ms</span>
              </div>
              <div className="p-2.5 border border-border bg-muted/20 space-y-1">
                <span className="text-muted-foreground block text-[11px]">Content Download</span>
                <span className="font-semibold text-foreground">{result.timing?.downloadMs || 0} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Tests Results */}
        {activeTab === 'tests' && (
          <div className="p-3 space-y-2">
            {testResults.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono p-4 text-center">
                No assertions were defined for this request. Configure tests under the "Tests" tab in the request builder.
              </p>
            ) : (
              <div className="space-y-1.5">
                {testResults.map((test, index) => (
                  <div
                    key={index}
                    className={`p-2.5 border flex items-start justify-between gap-3 text-xs font-mono ${
                      test.passed
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-rose-500/20 bg-rose-500/5'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        {test.passed ? (
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-emerald-500" />
                        ) : (
                          <HugeiconsIcon icon={Cancel01Icon} className="size-4 text-rose-500" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">{test.name}</span>
                        {!test.passed && (
                          <div className="text-[11px] text-muted-foreground">
                            Expected: <code className="text-foreground">{JSON.stringify(test.expected)}</code>, Received:{' '}
                            <code className="text-rose-500">{JSON.stringify(test.actual)}</code>
                          </div>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 ${
                        test.passed ? 'border-emerald-500 text-emerald-500' : 'border-rose-500 text-rose-500'
                      }`}
                    >
                      {test.passed ? 'PASSED' : 'FAILED'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
