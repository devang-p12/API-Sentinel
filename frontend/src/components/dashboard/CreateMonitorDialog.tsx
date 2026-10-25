import { useState, useEffect, type FormEvent } from 'react';
import type { Environment } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environments: Environment[];
  onCreate: (data: any) => Promise<void>;
}

export function CreateMonitorDialog({
  open,
  onOpenChange,
  environments,
  onCreate,
}: CreateMonitorDialogProps) {
  const [name, setName] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [url, setUrl] = useState('/healthy');
  const [environmentId, setEnvironmentId] = useState(environments[0]?.id || '');
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [expectedStatusCode, setExpectedStatusCode] = useState(200);
  const [requiredKeysStr, setRequiredKeysStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync default environment
  useEffect(() => {
    if (environments.length > 0 && !environmentId) {
      setEnvironmentId(environments[0].id);
    }
  }, [environments, environmentId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || !environmentId) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const assertions: any[] = [
        { type: 'statusCode', expected: Number(expectedStatusCode) },
      ];

      if (requiredKeysStr.trim()) {
        const keys = requiredKeysStr.split(',').map((k) => k.trim()).filter(Boolean);
        if (keys.length > 0) {
          assertions.push({
            type: 'schema',
            requiredKeys: keys,
          });
        }
      }

      await onCreate({
        name,
        method,
        url,
        environmentId,
        intervalSeconds: Number(intervalSeconds),
        timeoutMs: Number(timeoutMs),
        expectedStatusCode: Number(expectedStatusCode),
        assertions,
      });

      // Reset and close
      setName('');
      setUrl('/healthy');
      setRequiredKeysStr('');
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create monitor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-heading">Register New API Monitor</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure outside-in continuous health and latency probing for an API endpoint.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-3 py-3 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Monitor Name *</label>
              <Input
                placeholder="e.g. Health Check GET /healthy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-medium text-foreground block mb-1">Environment *</label>
                <select
                  value={environmentId}
                  onChange={(e) => setEnvironmentId(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-input bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name} ({env.baseUrl || 'no base'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">HTTP Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full h-8 px-2 rounded border border-input bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Expected Status</label>
                <Input
                  type="number"
                  value={expectedStatusCode}
                  onChange={(e) => setExpectedStatusCode(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Endpoint Path or Full URL *</label>
              <Input
                placeholder="e.g. /healthy or https://api.service.com/health"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-8 text-xs font-mono"
                required
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Relative paths will automatically prepend the environment base URL.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-medium text-foreground block mb-1">Interval (seconds)</label>
                <Input
                  type="number"
                  min={5}
                  max={86400}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Timeout (ms)</label>
                <Input
                  type="number"
                  min={500}
                  max={60000}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Schema Assertion (Optional)
              </label>
              <Input
                placeholder="e.g. id, status, data (comma-separated keys)"
                value={requiredKeysStr}
                onChange={(e) => setRequiredKeysStr(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Fails probe if response JSON does not contain these required fields.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Create Monitor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
