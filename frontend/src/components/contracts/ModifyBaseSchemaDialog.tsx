import { useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FileCodeIcon,
  Tick01Icon,
  Alert02Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { api, type ApiSchemaSummary } from '@/lib/api';

interface ModifyBaseSchemaDialogProps {
  schema: ApiSchemaSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ModifyBaseSchemaDialog({
  schema,
  open,
  onOpenChange,
  onSuccess,
}: ModifyBaseSchemaDialogProps) {
  const [editorMode, setEditorMode] = useState<'samplePayload' | 'schemaAst'>('samplePayload');
  const [jsonContent, setJsonContent] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load existing baseline data into editor when opened
  useEffect(() => {
    if (open && schema) {
      const baselineVersion =
        schema.versions?.find((v) => v.isBaseline) || schema.versions?.[0];

      if (editorMode === 'samplePayload') {
        const payload = baselineVersion?.samplePayload;
        if (payload && Object.keys(payload).length > 0) {
          setJsonContent(JSON.stringify(payload, null, 2));
        } else {
          // Provide placeholder derived from normalized schema or empty object
          setJsonContent(
            JSON.stringify(
              {
                status: 'success',
                data: {
                  id: 'sample_123',
                  message: 'Baseline response',
                },
              },
              null,
              2,
            ),
          );
        }
      } else {
        const ast = baselineVersion?.normalizedSchema;
        if (ast && Object.keys(ast).length > 0) {
          setJsonContent(JSON.stringify(ast, null, 2));
        } else {
          setJsonContent(
            JSON.stringify(
              {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  data: { type: 'object' },
                },
                required: ['status'],
              },
              null,
              2,
            ),
          );
        }
      }
      setJsonError(null);
      setSaveError(null);
    }
  }, [open, schema, editorMode]);

  // Validate JSON on change
  const handleContentChange = (val: string) => {
    setJsonContent(val);
    setSaveError(null);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      setJsonContent(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e: any) {
      setJsonError(`Cannot format invalid JSON: ${e.message}`);
    }
  };

  const handleSave = async () => {
    if (!schema) return;
    try {
      const parsed = JSON.parse(jsonContent);
      setIsSaving(true);
      setSaveError(null);

      if (editorMode === 'samplePayload') {
        await api.modifyBaseSchema(schema.id, { samplePayload: parsed });
      } else {
        await api.modifyBaseSchema(schema.id, { schemaJson: parsed });
      }

      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      setSaveError(e.message || 'Failed to update base schema.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!schema) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col bg-card border-border font-mono text-xs">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] font-mono font-bold ${
                schema.method === 'GET'
                  ? 'text-emerald-500 border-emerald-500/30'
                  : schema.method === 'POST'
                  ? 'text-blue-500 border-blue-500/30'
                  : schema.method === 'PUT'
                  ? 'text-amber-500 border-amber-500/30'
                  : 'text-purple-500 border-purple-500/30'
              }`}
            >
              {schema.method}
            </Badge>
            <DialogTitle className="text-sm font-mono font-semibold truncate text-foreground">
              {schema.endpoint}
            </DialogTitle>
            {schema.api && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {schema.api.name}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs font-mono text-muted-foreground mt-1">
            Directly edit the active contract baseline. Probe executions will be evaluated against this schema definition.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector */}
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2 shrink-0">
          <div className="flex items-center gap-1 p-0.5 bg-muted/40 border border-border text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setEditorMode('samplePayload')}
              className={`px-2.5 py-1 transition-colors ${
                editorMode === 'samplePayload'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sample Response JSON
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('schemaAst')}
              className={`px-2.5 py-1 transition-colors ${
                editorMode === 'schemaAst'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Normalized AST Schema
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={formatJson}
            className="h-7 text-[10px] font-mono"
          >
            Format JSON
          </Button>
        </div>

        {/* Editor Area */}
        <div className="flex-1 min-h-[300px] flex flex-col space-y-2 py-2 overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {editorMode === 'samplePayload'
                ? 'Provide a valid JSON representation of the expected successful response payload:'
                : 'Define or customize the structural schema AST node:'}
            </span>
            {jsonError ? (
              <span className="text-rose-500 flex items-center gap-1 font-semibold">
                <HugeiconsIcon icon={Alert02Icon} className="size-3" />
                Invalid JSON
              </span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1 font-semibold">
                <HugeiconsIcon icon={Tick01Icon} className="size-3" />
                Valid JSON
              </span>
            )}
          </div>

          <textarea
            value={jsonContent}
            onChange={(e) => handleContentChange(e.target.value)}
            className="flex-1 w-full min-h-[280px] p-3 bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:border-ring resize-y rounded"
            spellCheck={false}
          />

          {jsonError && (
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-mono rounded">
              Syntax error: {jsonError}
            </div>
          )}

          {saveError && (
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-mono rounded">
              {saveError}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3 shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            Saving creates a new approved baseline and clears unacknowledged drift.
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-mono"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || Boolean(jsonError)}
              className="h-8 text-xs font-mono font-bold"
            >
              <HugeiconsIcon icon={FileCodeIcon} className="size-3.5 mr-1.5" />
              {isSaving ? 'Saving...' : 'Set as Base Schema'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
