import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LabelEditorProps {
  labels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
}

export function LabelEditor({ labels, onChange }: LabelEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const entries = Object.entries(labels || {});

  const handleAdd = () => {
    const k = newKey.trim();
    const v = newValue.trim();

    if (!k) {
      setError('Label key cannot be empty');
      return;
    }

    if (labels[k] !== undefined) {
      setError(`Label key "${k}" already exists`);
      return;
    }

    onChange({
      ...labels,
      [k]: v,
    });

    setNewKey('');
    setNewValue('');
    setError(null);
  };

  const handleDelete = (keyToDelete: string) => {
    const next = { ...labels };
    delete next[keyToDelete];
    onChange(next);
  };

  const handleUpdateValue = (key: string, val: string) => {
    onChange({
      ...labels,
      [key]: val,
    });
  };

  const handleSuggestion = (sugKey: string, sugVal = '') => {
    if (labels[sugKey] !== undefined) return;
    onChange({
      ...labels,
      [sugKey]: sugVal,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-foreground block mb-1">
          Dimensions & Labels
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Key-value tags attached to firing alerts. Used by Notification Policies for incident routing.
        </p>

        {/* Existing labels table */}
        {entries.length > 0 && (
          <div className="border border-border/80 rounded-md divide-y divide-border/40 bg-card mb-3 font-mono text-xs">
            {entries.map(([k, v]) => (
              <div key={k} className="p-2 flex items-center gap-2">
                <span className="w-1/3 truncate font-semibold text-foreground px-2 py-1 rounded bg-muted/40 border border-border/40">
                  {k}
                </span>
                <span className="text-muted-foreground">=</span>
                <Input
                  type="text"
                  value={v}
                  onChange={(e) => handleUpdateValue(k, e.target.value)}
                  placeholder="value..."
                  className="h-7 text-xs font-mono flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(k)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add label input row */}
        <div className="p-2.5 rounded-md border border-dashed border-border bg-muted/10 space-y-2">
          <div className="flex flex-col sm:flex-row items-center gap-2 font-mono">
            <Input
              type="text"
              placeholder="key (e.g. team)"
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="h-8 text-xs font-mono"
            />
            <span className="text-muted-foreground hidden sm:inline">=</span>
            <Input
              type="text"
              placeholder="value (e.g. backend)"
              value={newValue}
              onChange={(e) => {
                setNewValue(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="h-8 text-xs font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              className="h-8 px-3 text-xs shrink-0 w-full sm:w-auto"
            >
              Add label
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Quick suggestions */}
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground flex-wrap">
            <span>Suggestions:</span>
            {['team', 'service', 'tier', 'region'].map((sug) => (
              <button
                key={sug}
                type="button"
                disabled={labels[sug] !== undefined}
                onClick={() => handleSuggestion(sug)}
                className="px-1.5 py-0.5 rounded border border-border/60 hover:bg-muted font-mono disabled:opacity-40 disabled:pointer-events-none"
              >
                +{sug}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
