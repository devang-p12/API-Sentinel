import { useState } from 'react';
import type { ApiRequestHistory } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Delete02Icon, Clock01Icon } from '@hugeicons/core-free-icons';

interface RequestHistoryListProps {
  history: ApiRequestHistory[];
  onSelectHistory: (item: ApiRequestHistory) => void;
  onClearHistory: () => Promise<void>;
}

export function RequestHistoryList({
  history,
  onSelectHistory,
  onClearHistory,
}: RequestHistoryListProps) {
  const [filter, setFilter] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const filtered = history.filter((item) => {
    if (!filter.trim()) return true;
    const term = filter.toLowerCase();
    return (
      item.url.toLowerCase().includes(term) ||
      item.method.toLowerCase().includes(term) ||
      String(item.status || '').includes(term)
    );
  });

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'text-emerald-500';
      case 'POST':
        return 'text-sky-500';
      case 'PUT':
      case 'PATCH':
        return 'text-amber-500';
      case 'DELETE':
        return 'text-rose-500';
      default:
        return 'text-purple-500';
    }
  };

  const getStatusBadge = (status?: number | null) => {
    if (!status) {
      return <span className="font-mono text-[10px] text-destructive">ERR</span>;
    }
    if (status >= 200 && status < 300) {
      return <span className="font-mono text-[10px] text-emerald-500 font-semibold">{status}</span>;
    }
    if (status >= 400 && status < 500) {
      return <span className="font-mono text-[10px] text-amber-500 font-semibold">{status}</span>;
    }
    return <span className="font-mono text-[10px] text-rose-500 font-semibold">{status}</span>;
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear request history?')) {
      setIsClearing(true);
      try {
        await onClearHistory();
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="space-y-2 text-xs">
      {/* Header and Clear Button */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="font-heading font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          History ({history.length})
        </span>
        {history.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleClear}
            disabled={isClearing}
            className="h-6 px-1.5 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
            title="Clear all execution history"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3" />
            <span>Clear</span>
          </Button>
        )}
      </div>

      {/* Filter Input */}
      {history.length > 0 && (
        <div className="relative px-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter history..."
            className="h-7 text-xs font-mono pl-7 rounded-none bg-muted/20 border-border"
          />
          <HugeiconsIcon
            icon={Search01Icon}
            className="size-3.5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2"
          />
        </div>
      )}

      {/* Empty State */}
      {history.length === 0 && (
        <div className="p-4 text-center border border-dashed border-border bg-card/20 space-y-2">
          <HugeiconsIcon icon={Clock01Icon} className="size-5 text-muted-foreground mx-auto" />
          <p className="text-[11px] text-muted-foreground">
            No execution history recorded yet. Executed requests will appear here.
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-0.5 max-h-[600px] overflow-y-auto px-1">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectHistory(item)}
            className="group flex flex-col p-2 border border-transparent hover:border-border hover:bg-muted/40 transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`font-mono text-[10px] font-bold shrink-0 ${getMethodColor(item.method)}`}>
                  {item.method}
                </span>
                <span className="font-mono text-xs text-foreground truncate select-all">
                  {item.url}
                </span>
              </div>
              <div className="shrink-0">{getStatusBadge(item.status)}</div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground font-mono">
              <span>{item.durationMs !== null ? `${item.durationMs}ms` : '—'}</span>
              <span>{formatRelativeTime(item.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
