import { useState } from 'react';
import type { HttpMethod } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlayIcon,
  Cancel01Icon,
  Copy01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';

interface RequestUrlBarProps {
  method: HttpMethod;
  onMethodChange: (method: HttpMethod) => void;
  url: string;
  onUrlChange: (url: string) => void;
  isExecuting: boolean;
  onSend: () => void;
  onCancel: () => void;
  onCopyCurl: () => void;
  resolvedUrlPreview?: string;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function RequestUrlBar({
  method,
  onMethodChange,
  url,
  onUrlChange,
  isExecuting,
  onSend,
  onCancel,
  onCopyCurl,
  resolvedUrlPreview,
}: RequestUrlBarProps) {
  const [copied, setCopied] = useState(false);

  const getMethodBadgeClass = (m: HttpMethod) => {
    switch (m) {
      case 'GET':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
      case 'POST':
        return 'text-sky-500 bg-sky-500/10 border-sky-500/30';
      case 'PUT':
      case 'PATCH':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'DELETE':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/30';
      default:
        return 'text-purple-500 bg-purple-500/10 border-purple-500/30';
    }
  };

  const handleCopy = () => {
    onCopyCurl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (isExecuting) {
        onCancel();
      } else {
        onSend();
      }
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 p-1 bg-muted/20 border border-border">
        {/* Method Selector Dropdown */}
        <div className="relative shrink-0">
          <select
            value={method}
            onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
            disabled={isExecuting}
            className={`h-9 px-2.5 text-xs font-mono font-bold tracking-wider border rounded-none focus:outline-none cursor-pointer ${getMethodBadgeClass(
              method,
            )}`}
          >
            {METHODS.map((m) => (
              <option key={m} value={m} className="bg-card text-foreground font-sans">
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* URL Input */}
        <div className="relative flex-1">
          <Input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder="Enter request URL (e.g. {{baseUrl}}/users or https://api.example.com/v1/resource)"
            className="h-9 font-mono text-xs pr-8 rounded-none border-border bg-background"
          />
          {url && !isExecuting && (
            <button
              type="button"
              onClick={() => onUrlChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Clear URL"
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
            </button>
          )}
        </div>

        {/* Send / Cancel Button */}
        {isExecuting ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onCancel}
            className="h-9 px-4 gap-1.5 rounded-none font-semibold text-xs shrink-0"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5 animate-spin" />
            <span>Cancel</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={onSend}
            className="h-9 px-4 gap-1.5 rounded-none font-semibold text-xs shrink-0"
          >
            <HugeiconsIcon icon={PlayIcon} className="size-3.5 fill-current" />
            <span>Send</span>
            <kbd className="hidden sm:inline-block ml-1 px-1 py-0.2 bg-primary-foreground/20 text-primary-foreground rounded text-[10px] font-mono">
              ⌘↵
            </kbd>
          </Button>
        )}

        {/* Copy as cURL Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="h-9 px-2.5 rounded-none shrink-0"
          title="Copy equivalent cURL command to clipboard"
        >
          {copied ? (
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5 text-emerald-500" />
          ) : (
            <HugeiconsIcon icon={Copy01Icon} className="size-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* URL Variable Resolution Preview */}
      {resolvedUrlPreview && resolvedUrlPreview !== url && (
        <div className="flex items-center gap-1.5 px-2 text-[11px] font-mono text-muted-foreground truncate">
          <span className="text-[10px] text-primary/80 uppercase font-semibold">Resolved URL:</span>
          <span className="truncate select-all">{resolvedUrlPreview}</span>
        </div>
      )}
    </div>
  );
}
