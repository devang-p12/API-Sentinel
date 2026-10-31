import { useState } from 'react';
import type { ApiTesterAuth, ApiTesterAuthType } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HugeiconsIcon } from '@hugeicons/react';
import { ViewIcon, ViewOffIcon, ShieldCheckIcon } from '@hugeicons/core-free-icons';

interface AuthEditorProps {
  auth: ApiTesterAuth;
  onChange: (auth: ApiTesterAuth) => void;
}

export function AuthEditor({ auth, onChange }: AuthEditorProps) {
  const [showSecret, setShowSecret] = useState(false);

  const handleTypeChange = (type: ApiTesterAuthType) => {
    onChange({
      ...auth,
      type,
      apiKeyName: auth.apiKeyName || 'X-API-Key',
      apiKeyPlacement: auth.apiKeyPlacement || 'header',
    });
  };

  return (
    <div className="space-y-4 max-w-xl">
      {/* Auth Type Selector */}
      <div className="space-y-1.5">
        <Label className="text-xs font-mono text-muted-foreground">Type</Label>
        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: 'none', label: 'No Auth' },
              { id: 'bearer', label: 'Bearer Token' },
              { id: 'basic', label: 'Basic Auth' },
              { id: 'apiKey', label: 'API Key' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTypeChange(item.id)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                auth.type === item.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted border-border'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* No Auth */}
      {auth.type === 'none' && (
        <div className="p-4 border border-dashed border-border bg-card/30 text-xs text-muted-foreground">
          This request does not use any authorization headers or tokens.
        </div>
      )}

      {/* Bearer Token */}
      {auth.type === 'bearer' && (
        <div className="space-y-2 p-3 border border-border bg-card/40">
          <Label className="text-xs font-mono">Token</Label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={auth.token || ''}
              onChange={(e) => onChange({ ...auth, token: e.target.value })}
              placeholder="e.g. eyJhbGciOi... or {{token}}"
              className="font-mono text-xs pr-8 rounded-none"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title={showSecret ? 'Hide token' : 'Show token'}
            >
              <HugeiconsIcon icon={showSecret ? ViewOffIcon : ViewIcon} className="size-3.5" />
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Appends an <code className="text-foreground">Authorization: Bearer &lt;token&gt;</code> header.
          </span>
        </div>
      )}

      {/* Basic Auth */}
      {auth.type === 'basic' && (
        <div className="space-y-3 p-3 border border-border bg-card/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Username</Label>
              <Input
                value={auth.username || ''}
                onChange={(e) => onChange({ ...auth, username: e.target.value })}
                placeholder="Username or {{username}}"
                className="font-mono text-xs rounded-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Password</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={auth.password || ''}
                  onChange={(e) => onChange({ ...auth, password: e.target.value })}
                  placeholder="Password or {{password}}"
                  className="font-mono text-xs pr-8 rounded-none"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={showSecret ? ViewOffIcon : ViewIcon} className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Appends an <code className="text-foreground">Authorization: Basic base64(user:pass)</code> header.
          </span>
        </div>
      )}

      {/* API Key */}
      {auth.type === 'apiKey' && (
        <div className="space-y-3 p-3 border border-border bg-card/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Key Name</Label>
              <Input
                value={auth.apiKeyName || 'X-API-Key'}
                onChange={(e) => onChange({ ...auth, apiKeyName: e.target.value })}
                placeholder="X-API-Key"
                className="font-mono text-xs rounded-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Key Value</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={auth.apiKeyValue || ''}
                  onChange={(e) => onChange({ ...auth, apiKeyValue: e.target.value })}
                  placeholder="Secret key or {{apiKey}}"
                  className="font-mono text-xs pr-8 rounded-none"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={showSecret ? ViewOffIcon : ViewIcon} className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-mono">Add To</Label>
            <div className="flex gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="apiKeyPlacement"
                  checked={auth.apiKeyPlacement !== 'query'}
                  onChange={() => onChange({ ...auth, apiKeyPlacement: 'header' })}
                  className="accent-primary"
                />
                <span>Header</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="apiKeyPlacement"
                  checked={auth.apiKeyPlacement === 'query'}
                  onChange={() => onChange({ ...auth, apiKeyPlacement: 'query' })}
                  className="accent-primary"
                />
                <span>Query Parameter</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="flex items-center gap-2 p-2 bg-muted/20 border border-border text-[11px] text-muted-foreground">
        <HugeiconsIcon icon={ShieldCheckIcon} className="size-4 text-emerald-500 shrink-0" />
        <span>
          Authentication secrets are never logged in history summaries and are safely transmitted directly to the target API.
        </span>
      </div>
    </div>
  );
}
