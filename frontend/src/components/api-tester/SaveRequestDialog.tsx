import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ApiCollection } from '@/lib/api';

interface SaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: ApiCollection[];
  currentName?: string;
  currentDescription?: string;
  currentCollectionId?: string;
  onSave: (data: {
    name: string;
    description?: string;
    collectionId?: string;
    newCollectionName?: string;
  }) => Promise<void>;
}

export function SaveRequestDialog({
  open,
  onOpenChange,
  collections,
  currentName = '',
  currentDescription = '',
  currentCollectionId = '',
  onSave,
}: SaveRequestDialogProps) {
  const [name, setName] = useState(currentName || 'New API Request');
  const [description, setDescription] = useState(currentDescription || '');
  const [collectionId, setCollectionId] = useState(currentCollectionId || '');
  const [createNewCollection, setCreateNewCollection] = useState(collections.length === 0);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName || 'New API Request');
      setDescription(currentDescription || '');
      setCollectionId(currentCollectionId || (collections[0]?.id || ''));
      setCreateNewCollection(collections.length === 0);
      setNewCollectionName('');
      setError(null);
    }
  }, [open, currentName, currentDescription, currentCollectionId, collections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this request.');
      return;
    }

    if (createNewCollection && !newCollectionName.trim()) {
      setError('Please provide a name for the new collection.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        collectionId: createNewCollection ? undefined : collectionId || undefined,
        newCollectionName: createNewCollection ? newCollectionName.trim() : undefined,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save request.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm">Save Request to Workspace</DialogTitle>
          <DialogDescription className="text-xs">
            Save this configured request into an API Collection for one-click re-use and team sharing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="req-name" className="text-xs">
              Request Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="req-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Get User Profile"
              className="text-xs rounded-none h-8"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Collection</Label>
              {collections.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCreateNewCollection(!createNewCollection)}
                  className="text-[11px] text-primary hover:underline font-mono"
                >
                  {createNewCollection ? 'Select Existing' : '+ New Collection'}
                </button>
              )}
            </div>

            {createNewCollection ? (
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g. Users Service, Payments API"
                className="text-xs rounded-none h-8 font-mono"
              />
            ) : (
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full h-8 text-xs bg-background border border-border px-2 rounded-none font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name} ({col.requests?.length || 0} requests)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-desc" className="text-xs text-muted-foreground">
              Description (Optional)
            </Label>
            <Textarea
              id="req-desc"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Brief notes about query parameters or required permissions..."
              className="text-xs rounded-none h-20 resize-none"
            />
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 font-mono">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-none"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="rounded-none font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
