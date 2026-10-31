import type { ApiTesterAssertion, ApiAssertionType } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';

interface TestsEditorProps {
  tests: ApiTesterAssertion[];
  onChange: (tests: ApiTesterAssertion[]) => void;
}

const ASSERTION_TYPES: Array<{ id: ApiAssertionType; label: string; placeholder: string; hasTarget: boolean }> = [
  { id: 'status_code_equals', label: 'Status Code Equals', placeholder: '200', hasTarget: false },
  { id: 'response_time_less_than', label: 'Response Time Less Than (ms)', placeholder: '1000', hasTarget: false },
  { id: 'response_contains_text', label: 'Body Contains Text', placeholder: 'success', hasTarget: false },
  { id: 'json_property_exists', label: 'JSON Property Exists', placeholder: '', hasTarget: true },
  { id: 'json_property_equals', label: 'JSON Property Equals', placeholder: 'active', hasTarget: true },
];

export function TestsEditor({ tests, onChange }: TestsEditorProps) {
  const handleToggle = (index: number) => {
    const updated = [...tests];
    updated[index].enabled = updated[index].enabled === false ? true : false;
    onChange(updated);
  };

  const handleFieldChange = (
    index: number,
    field: keyof ApiTesterAssertion,
    value: any,
  ) => {
    const updated = [...tests];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddTest = (preset?: Partial<ApiTesterAssertion>) => {
    onChange([
      ...tests,
      {
        id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: preset?.name || 'Status is 200',
        type: preset?.type || 'status_code_equals',
        target: preset?.target || '',
        expected: preset?.expected !== undefined ? preset.expected : 200,
        enabled: true,
      },
    ]);
  };

  const handleDeleteTest = (index: number) => {
    onChange(tests.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span>Quick Assertions:</span>
          <button
            type="button"
            onClick={() =>
              handleAddTest({
                name: 'Status code is 200',
                type: 'status_code_equals',
                expected: 200,
              })
            }
            className="px-1.5 py-0.5 border border-border bg-muted/30 hover:bg-muted text-[11px] font-mono text-foreground"
          >
            + Status 200
          </button>
          <button
            type="button"
            onClick={() =>
              handleAddTest({
                name: 'Latency < 1000ms',
                type: 'response_time_less_than',
                expected: 1000,
              })
            }
            className="px-1.5 py-0.5 border border-border bg-muted/30 hover:bg-muted text-[11px] font-mono text-foreground"
          >
            + Latency &lt; 1000ms
          </button>
          <button
            type="button"
            onClick={() =>
              handleAddTest({
                name: 'Has data object',
                type: 'json_property_exists',
                target: 'data',
              })
            }
            className="px-1.5 py-0.5 border border-border bg-muted/30 hover:bg-muted text-[11px] font-mono text-foreground"
          >
            + Property Exists
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => handleAddTest()}
          className="rounded-none gap-1 h-6 text-[11px]"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3" />
          <span>Add Assertion</span>
        </Button>
      </div>

      {tests.length === 0 ? (
        <div className="p-8 border border-dashed border-border bg-card/20 text-center space-y-2">
          <div className="flex justify-center text-muted-foreground">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-5" />
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            No assertions configured. Add tests above to validate response status, latency, and JSON fields after every execution.
          </p>
        </div>
      ) : (
        <div className="border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-muted-foreground font-mono text-[11px]">
                <th className="w-10 px-2 py-1.5 text-center">Use</th>
                <th className="px-2 py-1.5 text-left w-1/4">Assertion Name</th>
                <th className="px-2 py-1.5 text-left w-1/4">Type</th>
                <th className="px-2 py-1.5 text-left w-1/4">Property Path / Target</th>
                <th className="px-2 py-1.5 text-left w-1/4">Expected Value</th>
                <th className="w-12 px-2 py-1.5 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {tests.map((test, index) => {
                const typeConfig = ASSERTION_TYPES.find((t) => t.id === test.type);
                return (
                  <tr key={test.id || index} className="hover:bg-muted/20">
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={test.enabled !== false}
                        onChange={() => handleToggle(index)}
                        className="size-3.5 accent-primary cursor-pointer rounded-none"
                        aria-label={`Toggle test ${test.name || index}`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={test.name || ''}
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        placeholder="Test title"
                        className="h-7 text-xs rounded-none border-transparent bg-transparent hover:border-border focus:border-border focus:bg-background"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        value={test.type}
                        onChange={(e) =>
                          handleFieldChange(index, 'type', e.target.value as ApiAssertionType)
                        }
                        className="w-full h-7 text-xs bg-transparent border-transparent hover:border-border focus:border-border focus:bg-background border rounded-none px-1.5 font-mono cursor-pointer"
                      >
                        {ASSERTION_TYPES.map((t) => (
                          <option key={t.id} value={t.id} className="bg-card text-foreground">
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      {typeConfig?.hasTarget ? (
                        <Input
                          value={test.target || ''}
                          onChange={(e) => handleFieldChange(index, 'target', e.target.value)}
                          placeholder="e.g. data.id or items[0].status"
                          className="h-7 text-xs font-mono rounded-none border-transparent bg-transparent hover:border-border focus:border-border focus:bg-background"
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50 font-mono px-2">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {test.type !== 'json_property_exists' ? (
                        <Input
                          value={test.expected !== undefined ? String(test.expected) : ''}
                          onChange={(e) => handleFieldChange(index, 'expected', e.target.value)}
                          placeholder={typeConfig?.placeholder || 'Expected value'}
                          className="h-7 text-xs font-mono rounded-none border-transparent bg-transparent hover:border-border focus:border-border focus:bg-background"
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50 font-mono px-2">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteTest(index)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title="Delete assertion"
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
