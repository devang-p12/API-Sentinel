import { useState } from 'react';
import type { ApiCollection, SavedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Folder01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Add01Icon,
  Delete02Icon,
  Copy01Icon,
  Edit01Icon,
} from '@hugeicons/core-free-icons';

interface CollectionsTreeProps {
  collections: ApiCollection[];
  activeRequestId?: string;
  onSelectRequest: (request: SavedApiRequest) => void;
  onCreateCollection: (name: string) => Promise<void>;
  onRenameCollection: (id: string, name: string) => Promise<void>;
  onDeleteCollection: (id: string) => Promise<void>;
  onDeleteRequest: (id: string) => Promise<void>;
  onDuplicateRequest: (request: SavedApiRequest) => Promise<void>;
}

export function CollectionsTree({
  collections,
  activeRequestId,
  onSelectRequest,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onDeleteRequest,
  onDuplicateRequest,
}: CollectionsTreeProps) {
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedCollections((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    await onCreateCollection(newColName.trim());
    setNewColName('');
    setIsCreatingCollection(false);
  };

  const handleRenameSubmit = async (id: string) => {
    if (!editingColName.trim()) return;
    await onRenameCollection(id, editingColName.trim());
    setEditingColId(null);
  };

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

  return (
    <div className="space-y-2 text-xs">
      {/* Header and Add Collection Button */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="font-heading font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          Collections ({collections.length})
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setIsCreatingCollection(true)}
          className="h-6 px-1.5 gap-1 text-[11px] hover:text-foreground"
          title="Create new collection"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3" />
          <span>New</span>
        </Button>
      </div>

      {/* New Collection Inline Form */}
      {isCreatingCollection && (
        <form onSubmit={handleCreateSubmit} className="p-2 border border-border bg-card/60 space-y-2">
          <Input
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            placeholder="Collection name..."
            className="h-7 text-xs rounded-none font-mono"
            autoFocus
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setIsCreatingCollection(false)}
              className="h-6 px-2 text-[11px]"
            >
              Cancel
            </Button>
            <Button type="submit" size="xs" className="h-6 px-2 text-[11px]">
              Create
            </Button>
          </div>
        </form>
      )}

      {/* Empty State */}
      {collections.length === 0 && !isCreatingCollection && (
        <div className="p-4 text-center border border-dashed border-border bg-card/20 space-y-2">
          <HugeiconsIcon icon={Folder01Icon} className="size-5 text-muted-foreground mx-auto" />
          <p className="text-[11px] text-muted-foreground">
            No collections in this project yet. Save requests to group them into test suites.
          </p>
        </div>
      )}

      {/* Collections Tree List */}
      <div className="space-y-1">
        {collections.map((col) => {
          const isExpanded = expandedCollections[col.id] !== false; // expanded by default
          const requests = col.requests || [];

          return (
            <div key={col.id} className="border border-border/60 bg-card/30">
              {/* Collection Header Row */}
              <div className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/30 select-none group">
                <button
                  type="button"
                  onClick={() => toggleExpand(col.id)}
                  className="flex items-center gap-1.5 min-w-0 text-left flex-1"
                >
                  <HugeiconsIcon
                    icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
                    className="size-3 text-muted-foreground shrink-0"
                  />
                  <HugeiconsIcon icon={Folder01Icon} className="size-3.5 text-primary shrink-0" />
                  {editingColId === col.id ? (
                    <Input
                      value={editingColName}
                      onChange={(e) => setEditingColName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(col.id);
                        if (e.key === 'Escape') setEditingColId(null);
                      }}
                      onBlur={() => handleRenameSubmit(col.id)}
                      className="h-6 text-xs py-0 font-medium rounded-none"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-foreground truncate">{col.name}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    ({requests.length})
                  </span>
                </button>

                {/* Collection Action Buttons */}
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingColId(col.id);
                      setEditingColName(col.name);
                    }}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Rename Collection"
                  >
                    <HugeiconsIcon icon={Edit01Icon} className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCollection(col.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    title="Delete Collection"
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-3" />
                  </button>
                </div>
              </div>

              {/* Nested Saved Requests */}
              {isExpanded && (
                <div className="pl-5 pr-1 py-1 space-y-0.5 border-t border-border/40 bg-background/50">
                  {requests.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60 py-1 font-mono italic">
                      Empty collection
                    </p>
                  ) : (
                    requests.map((req) => (
                      <div
                        key={req.id}
                        className={`group flex items-center justify-between px-2 py-1 border transition-colors cursor-pointer ${
                          activeRequestId === req.id
                            ? 'bg-muted border-border font-medium text-foreground'
                            : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => onSelectRequest(req)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`font-mono text-[10px] font-bold shrink-0 ${getMethodColor(
                              req.method,
                            )}`}
                          >
                            {req.method}
                          </span>
                          <span className="truncate text-xs">{req.name}</span>
                        </div>

                        {/* Request Actions */}
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateRequest(req);
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Duplicate Request"
                          >
                            <HugeiconsIcon icon={Copy01Icon} className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRequest(req.id);
                            }}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            title="Delete Request"
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
