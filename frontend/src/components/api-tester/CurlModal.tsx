import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { HttpMethod } from '@/lib/api';

import { parseCurlCommand } from '@/lib/curl-parser';

interface CurlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (parsed: {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }) => void;
}

export function CurlModal({ open, onOpenChange, onImport }: CurlModalProps) {
  const [curlText, setCurlText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleParseAndImport = () => {
    setError(null);
    try {
      const parsed = parseCurlCommand(curlText);
      onImport({
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        body: parsed.body,
      });
      setCurlText('');
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse cURL command');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-none">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm">Import cURL Command</DialogTitle>
          <DialogDescription className="text-xs">
            Paste a cURL command from your browser developer tools or documentation to populate the API Tester.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Textarea
            value={curlText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurlText(e.target.value)}
            placeholder={`curl -X POST 'https://api.example.com/v1/users' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name": "Devang"}'`}
            className="font-mono text-xs h-40 resize-none rounded-none bg-muted/30"
          />

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 font-mono">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-none"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleParseAndImport}
            className="rounded-none font-medium"
          >
            Import Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
