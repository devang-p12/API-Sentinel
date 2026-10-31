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
    const text = curlText.trim();
    if (!text) {
      setError('Please paste a cURL command.');
      return;
    }

    try {
      // Normalize line breaks and backslashes
      const singleLine = text.replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ');

      // Extract method: -X POST or --request POST
      let method: HttpMethod = 'GET';
      const methodMatch = singleLine.match(/(?:-X|--request)\s+([A-Z]+)/i);
      if (methodMatch) {
        method = methodMatch[1].toUpperCase() as HttpMethod;
      }

      // Extract headers: -H 'Name: Value' or --header 'Name: Value'
      const headers: Record<string, string> = {};
      const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/g;
      let hMatch: RegExpExecArray | null;
      while ((hMatch = headerRegex.exec(singleLine)) !== null) {
        const headerStr = hMatch[1];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          const key = headerStr.slice(0, colonIdx).trim();
          const val = headerStr.slice(colonIdx + 1).trim();
          headers[key] = val;
        }
      }

      // Extract body: -d '...', --data '...', --data-raw '...'
      let body: string | undefined;
      const dataMatch = singleLine.match(
        /(?:-d|--data|--data-raw|--data-binary)\s+(['"])([\s\S]*?)\1/,
      );
      if (dataMatch) {
        body = dataMatch[2];
        if (!methodMatch) {
          method = 'POST'; // Default to POST if body is present without explicit -X
        }
      }

      // Extract URL: either quoted or unquoted URL string
      let url = '';
      // Check --url first
      const explicitUrlMatch = singleLine.match(/--url\s+['"]?([^'"\s]+)['"]?/);
      if (explicitUrlMatch) {
        url = explicitUrlMatch[1];
      } else {
        // Find token that starts with http://, https://, or {{
        const tokens = singleLine.split(/\s+/);
        for (const token of tokens) {
          const cleanToken = token.replace(/^['"]|['"]$/g, '');
          if (
            cleanToken.startsWith('http://') ||
            cleanToken.startsWith('https://') ||
            cleanToken.startsWith('{{')
          ) {
            url = cleanToken;
            break;
          }
        }
      }

      if (!url) {
        setError(
          'Could not find a valid URL in the cURL command. Make sure it contains an http:// or https:// URL.',
        );
        return;
      }

      onImport({ method, url, headers, body });
      setCurlText('');
      onOpenChange(false);
    } catch (err: any) {
      setError(`Failed to parse cURL command: ${err.message}`);
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
