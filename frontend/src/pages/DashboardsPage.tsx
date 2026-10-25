import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Dashboard } from '@/lib/api';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateDashboardDialog } from '@/components/dashboards/CreateDashboardDialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ChartLineData01Icon,
  Add01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';

export function DashboardsPage() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    setIsLoading(true);
    try {
      const list = await api.getDashboards();
      setDashboards(list);
    } catch (err) {
      console.error('Failed to load dashboards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (data: { name: string; description?: string; projectId?: string }) => {
    const created = await api.createDashboard(data);
    await loadDashboards();
    navigate(`/dashboards/${created.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this custom dashboard?')) return;
    try {
      await api.deleteDashboard(id);
      await loadDashboards();
    } catch (err) {
      console.error('Failed to delete dashboard:', err);
    }
  };

  return (
    <PageContainer
      title="Dashboards"
      description="Grafana-style customizable observability dashboards for API reliability, latency percentiles, error budgets, and health check telemetry."
      breadcrumbs={[{ label: 'Sentinel', href: '/dashboard' }, { label: 'Dashboards' }]}
      action={
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 font-medium">
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          <span>New Dashboard</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-2 text-muted-foreground text-xs animate-pulse">
            <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="font-mono">Loading custom dashboards...</span>
          </div>
        ) : dashboards.length === 0 ? (
          <Card className="rounded-none border-border border-dashed bg-card/30">
            <CardContent className="py-20 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <HugeiconsIcon icon={ChartLineData01Icon} className="size-6" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-heading font-semibold text-base text-foreground">
                  No Custom Dashboards Yet
                </h3>
                <p className="text-xs text-muted-foreground">
                  Build tailored API observability boards combining multi-service availability trends, P95/P99 latency percentiles, and HTTP status distribution metrics.
                </p>
              </div>
              <div className="pt-2">
                <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5">
                  <HugeiconsIcon icon={Add01Icon} className="size-4" />
                  <span>Create First Custom Board</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map((dash) => {
              const widgetCount = dash.widgets?.length || 0;
              return (
                <Card
                  key={dash.id}
                  onClick={() => navigate(`/dashboards/${dash.id}`)}
                  className="rounded-none border-border bg-card/60 hover:bg-card hover:border-primary/50 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <CardHeader className="py-4 px-4 border-b border-border/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {dash.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                          {dash.description || 'Custom reliability dashboard'}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                        {widgetCount} {widgetCount === 1 ? 'panel' : 'panels'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-3 flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <HugeiconsIcon icon={Clock01Icon} className="size-3" />
                      <span>{new Date(dash.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => handleDelete(e, dash.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                      </Button>
                      <Button variant="outline" size="xs" className="h-6 gap-1 font-mono text-[11px]">
                        <span>Open</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateDashboardDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreate={handleCreate}
      />
    </PageContainer>
  );
}
