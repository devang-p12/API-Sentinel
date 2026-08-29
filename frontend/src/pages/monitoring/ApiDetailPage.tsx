import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '@/context/ApiContext';
import {
  Activity, ArrowLeft, Globe, Server, CheckCircle2,
  XCircle, Clock3, AlertTriangle, Play, Pause, Settings,
  ActivitySquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const ApiDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateMonitoringConfig } = useApi();
  
  const [api, setApi] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApiData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [apiRes, detailsRes, logsRes] = await Promise.all([
          fetch(`/api/apis`),
          fetch(`/api/monitoring/${id}/health-details`),
          fetch(`/api/monitoring/${id}/logs?limit=40`)
        ]);

        if (apiRes.ok) {
          const apiData = await apiRes.json();
          const targetApi = apiData.data?.find((a: any) => String(a.id) === id);
          if (targetApi) setApi(targetApi);
        }

        if (detailsRes.ok) setDetails(await detailsRes.json());
        if (logsRes.ok) setLogs(await logsRes.json());
      } catch (err) {
        console.error('Failed to fetch API details', err);
      } finally {
        setLoading(false);
      }
    };

    fetchApiData();
    const interval = setInterval(fetchApiData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [id]);

  if (loading && !api) {
    return <div className="p-8 text-center text-muted-foreground">Loading API details...</div>;
  }

  if (!api) {
    return <div className="p-8 text-center text-muted-foreground">API not found.</div>;
  }

  const toggleMonitoring = async () => {
    if (!updateMonitoringConfig) return;
    await updateMonitoringConfig(api.id, {
      monitoringEnabled: !api.monitoringEnabled,
      monitoringInterval: api.monitoringInterval || 60,
      timeout: api.timeout || 5000,
      degradedThresholdMs: api.degradedThresholdMs || 1000
    });
    // Optimistic UI update
    setApi((prev: any) => ({ ...prev, monitoringEnabled: !prev.monitoringEnabled }));
  };

  const getStatusColor = (status: string) => {
    if (status === 'HEALTHY') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'DEGRADED') return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    if (status === 'DOWN') return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
  };

  const uptime = details?.stats?.uptime || '100.00';
  const errorRate = details?.stats?.errorRate || '0.00';
  const avgLatency = details?.stats?.avgResponseTime || '0';

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/monitoring/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{api.name}</h1>
                <Badge variant="outline" className={`px-2 py-0.5 ${getStatusColor(api.healthStatus || 'HEALTHY')}`}>
                  {api.healthStatus || 'HEALTHY'}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {api.environment}</span>
                <span className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> {api.baseUrl}</span>
              </div>
            </div>
          </div>
          <div>
            <Button 
              variant={api.monitoringEnabled ? "outline" : "default"} 
              size="sm" 
              onClick={toggleMonitoring}
              className={api.monitoringEnabled ? "border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" : ""}
            >
              {api.monitoringEnabled ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {api.monitoringEnabled ? 'Pause Monitoring' : 'Start Monitoring'}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg"><ActivitySquare className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Uptime (24h)</p>
                <p className="text-2xl font-semibold">{uptime}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg"><Clock3 className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Latency (24h)</p>
                <p className="text-2xl font-semibold">{avgLatency}ms</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 text-rose-500 rounded-lg"><AlertTriangle className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Error Rate (24h)</p>
                <p className="text-2xl font-semibold">{errorRate}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-slate-500/10 text-slate-500 rounded-lg"><Settings className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Check Interval</p>
                <p className="text-2xl font-semibold">{api.monitoringInterval || 60}s</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content: Recent Logs */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Checks</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Visual Timeline (mini chart) */}
              <div className="flex items-end gap-1 mb-6 h-24 border-b border-l px-2 pb-0 pt-4">
                {logs.slice().reverse().map((log: any, i: number) => {
                  const height = Math.min(100, Math.max(10, (log.response_time / (api.timeout || 5000)) * 100));
                  return (
                    <div key={i} className="group relative flex flex-1 items-end justify-center">
                      <div
                        className={`w-full rounded-t-sm transition-colors ${log.success ? (log.response_time > (api.degradedThresholdMs || 1000) ? 'bg-amber-500/80' : 'bg-emerald-500/80') : 'bg-rose-500/80'}`}
                        style={{ height: `${height}%` }}
                        title={`${log.response_time}ms - ${new Date(log.timestamp).toLocaleTimeString()}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.slice(0, 10).map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10 text-[10px]">
                              {log.status_code || 'OK'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-rose-500 border-rose-500/20 bg-rose-500/10 text-[10px]">
                              {log.status_code || 'ERR'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono text-xs ${log.response_time > (api.degradedThresholdMs || 1000) ? 'text-amber-500' : ''}`}>
                            {log.response_time}ms
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-rose-500 max-w-[200px] truncate" title={log.error_message || ''}>
                          {log.error_type || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Right Sidebar: Recent Failures */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-rose-500 flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Recent Failures
              </CardTitle>
            </CardHeader>
            <CardContent>
              {details?.recentFailures?.length > 0 ? (
                <div className="space-y-4">
                  {details.recentFailures.map((failure: any) => (
                    <div key={failure.id} className="text-sm p-3 border border-rose-500/20 bg-rose-500/5 rounded-md">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-rose-500">{failure.error_type}</span>
                        <span className="text-xs text-muted-foreground">{new Date(failure.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{failure.error_message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mb-2" />
                  <p className="text-sm">No recent failures</p>
                  <p className="text-xs">API has been stable.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
      </div>
    </div>
  );
};

export default ApiDetailPage;
