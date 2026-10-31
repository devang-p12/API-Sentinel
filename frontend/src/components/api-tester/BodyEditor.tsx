import { useState, useEffect } from 'react';
import type { ApiTesterBodyType } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle01Icon, Alert02Icon, SparklesIcon } from '@hugeicons/core-free-icons';

interface BodyEditorProps {
  bodyType: ApiTesterBodyType;
  onBodyTypeChange: (type: ApiTesterBodyType) => void;
  body: string;
  onBodyChange: (body: string) => void;
}

export function BodyEditor({
  bodyType,
  onBodyTypeChange,
  body,
  onBodyChange,
}: BodyEditorProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (bodyType === 'json') {
      if (!body.trim()) {
        setJsonError(null);
        return;
      }
      try {
        JSON.parse(body);
        setJsonError(null);
      } catch (err: any) {
        setJsonError(err.message);
      }
    } else {
      setJsonError(null);
    }
  }, [body, bodyType]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(body);
      onBodyChange(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (err: any) {
      setJsonError(`Cannot format invalid JSON: ${err.message}`);
    }
  };

  return (
    <div className="space-y-3">
      {/* Format Selector and Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'none', label: 'none' },
              { id: 'json', label: 'JSON' },
              { id: 'raw', label: 'raw' },
              { id: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onBodyTypeChange(item.id)}
              className={`px-2.5 py-1 text-xs font-mono border transition-colors ${
                bodyType === item.id
                  ? 'bg-muted text-foreground border-border font-semibold'
                  : 'bg-transparent text-muted-foreground hover:text-foreground border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {bodyType === 'json' && (
          <div className="flex items-center gap-2">
            {jsonError ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-destructive">
                <HugeiconsIcon icon={Alert02Icon} className="size-3.5" />
                <span>Invalid JSON</span>
              </span>
            ) : body.trim() ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-500">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
                <span>Valid JSON</span>
              </span>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleFormatJson}
              disabled={!body.trim()}
              className="rounded-none gap-1 h-6 text-[11px]"
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-3 text-primary" />
              <span>Beautify</span>
            </Button>
          </div>
        )}
      </div>

      {/* Editor Content */}
      {bodyType === 'none' && (
        <div className="p-8 border border-dashed border-border bg-card/20 text-center text-xs text-muted-foreground font-mono">
          This request has no body payload.
        </div>
      )}

      {bodyType !== 'none' && (
        <div className="space-y-1.5">
          <Textarea
            value={body}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onBodyChange(e.target.value)}
            placeholder={
              bodyType === 'json'
                ? '{\n  "key": "value",\n  "count": 42\n}'
                : bodyType === 'x-www-form-urlencoded'
                ? 'grant_type=client_credentials&client_id=123'
                : 'Raw text payload...'
            }
            className="font-mono text-xs h-64 resize-none rounded-none bg-muted/20 border-border leading-relaxed"
            spellCheck={false}
          />
          {jsonError && (
            <div className="p-2 bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-mono">
              Syntax error: {jsonError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
