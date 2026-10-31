import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Copy01Icon } from '@hugeicons/core-free-icons';

export interface ParamRow {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description?: string;
}

interface ParamsEditorProps {
  params: ParamRow[];
  onChange: (params: ParamRow[]) => void;
}

export function ParamsEditor({ params, onChange }: ParamsEditorProps) {
  const handleToggle = (index: number) => {
    const updated = [...params];
    updated[index].enabled = !updated[index].enabled;
    onChange(updated);
  };

  const handleFieldChange = (
    index: number,
    field: 'key' | 'value' | 'description',
    val: string,
  ) => {
    const updated = [...params];
    updated[index][field] = val;
    onChange(updated);
  };

  const handleAddRow = () => {
    onChange([
      ...params,
      {
        id: `param-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        enabled: true,
        key: '',
        value: '',
      },
    ]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = params.filter((_, i) => i !== index);
    if (updated.length === 0) {
      updated.push({
        id: `param-${Date.now()}`,
        enabled: true,
        key: '',
        value: '',
      });
    }
    onChange(updated);
  };

  const handleDuplicateRow = (index: number) => {
    const target = params[index];
    const updated = [...params];
    updated.splice(index + 1, 0, {
      ...target,
      id: `param-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    });
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">
          Query Parameters (Appended automatically to the request URL)
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={handleAddRow}
          className="rounded-none gap-1 h-6 text-[11px]"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3" />
          <span>Add Parameter</span>
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
            {params.map((row, index) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={() => handleToggle(index)}
                    className="size-3.5 accent-primary cursor-pointer rounded-none"
                    aria-label={`Toggle param ${row.key || index}`}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.key}
                    onChange={(e) => handleFieldChange(index, 'key', e.target.value)}
                    placeholder="Key (e.g. page, limit)"
                    className="h-7 text-xs font-mono rounded-none border-transparent bg-transparent hover:border-border focus:border-border focus:bg-background"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.value}
                    onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                    placeholder="Value (e.g. 1, {{userId}})"
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
                      title="Duplicate Parameter"
                    >
                      <HugeiconsIcon icon={Copy01Icon} className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(index)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Delete Parameter"
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
