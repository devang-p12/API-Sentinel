import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Copy01Icon } from '@hugeicons/core-free-icons';

export interface HeaderRow {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description?: string;
}

interface HeadersEditorProps {
  headers: HeaderRow[];
  onChange: (headers: HeaderRow[]) => void;
}

export function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  const handleToggle = (index: number) => {
    const updated = [...headers];
    updated[index].enabled = !updated[index].enabled;
    onChange(updated);
  };

  const handleFieldChange = (
    index: number,
    field: 'key' | 'value' | 'description',
    val: string,
  ) => {
    const updated = [...headers];
    updated[index][field] = val;
    onChange(updated);
  };

  const handleAddRow = () => {
    onChange([
      ...headers,
      {
        id: `header-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        enabled: true,
        key: '',
        value: '',
      },
    ]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = headers.filter((_, i) => i !== index);
    if (updated.length === 0) {
      updated.push({
        id: `header-${Date.now()}`,
        enabled: true,
        key: '',
        value: '',
      });
    }
    onChange(updated);
  };

  const handleDuplicateRow = (index: number) => {
    const target = headers[index];
    const updated = [...headers];
    updated.splice(index + 1, 0, {
      ...target,
      id: `header-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    });
    onChange(updated);
  };

  const handleAddPreset = (key: string, value: string) => {
    // If header key already exists, update it or enable it
    const existingIdx = headers.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
    if (existingIdx >= 0) {
      const updated = [...headers];
      updated[existingIdx].enabled = true;
      updated[existingIdx].value = value;
      onChange(updated);
    } else {
      onChange([
        ...headers,
        {
          id: `header-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          enabled: true,
          key,
          value,
        },
      ]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span>Presets:</span>
          <button
            type="button"
            onClick={() => handleAddPreset('Content-Type', 'application/json')}
            className="px-1.5 py-0.5 border border-border bg-muted/30 hover:bg-muted text-[11px] font-mono text-foreground"
          >
            application/json
          </button>
          <button
            type="button"
            onClick={() => handleAddPreset('Accept', 'application/json')}
            className="px-1.5 py-0.5 border border-border bg-muted/30 hover:bg-muted text-[11px] font-mono text-foreground"
          >
            Accept: JSON
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={handleAddRow}
          className="rounded-none gap-1 h-6 text-[11px]"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3" />
          <span>Add Header</span>
        </Button>
      </div>

      <div className="border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground font-mono text-[11px]">
              <th className="w-10 px-2 py-1.5 text-center">Use</th>
              <th className="px-2 py-1.5 text-left w-1/3">Key</th>
              <th className="px-2 py-1.5 text-left w-1/3">Value</th>
              <th className="px-2 py-1.5 text-left">Description</th>
              <th className="w-16 px-2 py-1.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {headers.map((row, index) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={() => handleToggle(index)}
                    className="size-3.5 accent-primary cursor-pointer rounded-none"
                    aria-label={`Toggle header ${row.key || index}`}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.key}
                    onChange={(e) => handleFieldChange(index, 'key', e.target.value)}
                    placeholder="Header (e.g. Content-Type, X-API-Key)"
                    className="h-7 text-xs font-mono rounded-none border-transparent bg-transparent hover:border-border focus:border-border focus:bg-background"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.value}
                    onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                    placeholder="Value (e.g. application/json, {{token}})"
                    className="h-7 text-xs font-mono rounded-none border-transparent bg-transparent hover:border-border focus:border-border focus:bg-background"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.description || ''}
                    onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                    placeholder="Description (optional)"
                    className="h-7 text-xs rounded-none border-transparent bg-transparent hover:border-border focus:border-border focus:bg-background"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicateRow(index)}
                      className="text-muted-foreground hover:text-foreground p-1"
                      title="Duplicate Header"
                    >
                      <HugeiconsIcon icon={Copy01Icon} className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(index)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Delete Header"
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="size-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
