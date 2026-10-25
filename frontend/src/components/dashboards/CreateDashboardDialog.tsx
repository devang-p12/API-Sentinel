import { useState, useEffect, type FormEvent } from 'react';
import { api, type Project } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; description?: string; projectId?: string }) => Promise<void>;
}

export function CreateDashboardDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateDashboardDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setError(null);
      api.getProjects().then((list) => {
        setProjects(list);
        if (list.length > 0) {
          setProjectId(list[0].id);
        }
      }).catch(console.error);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Dashboard name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        projectId: projectId || undefined,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">New Custom Dashboard</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create an API observability and reliability dashboard to organize your visualizations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
          {error && (
            <div className="p-2 border border-destructive/30 bg-destructive/10 text-destructive text-xs font-mono">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Dashboard Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production API Overview"
              required
              className="rounded-none border-input h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Real-time availability, latency distributions, and error budgets"
              className="rounded-none border-input h-8 text-xs"
            />
          </div>

          {projects.length > 1 && (
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-8 px-2.5 bg-input/20 border border-input rounded-none text-xs text-foreground"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter className="border-t border-border pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Dashboard'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
