import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AnalyticsData } from '@/types/api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell 
} from 'recharts';
import { Clock3, ActivitySquare, AlertTriangle, FastForward, Play, Server, Zap } from 'lucide-react';

interface ApiAnalyticsTabProps {
  apiId: number;
}

export const ApiAnalyticsTab: React.FC<ApiAnalyticsTabProps> = ({ apiId }) => {
  const [timeRange, setTimeRange] = useState('24h');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics?apiId=${apiId}&timeRange=${timeRange}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [apiId, timeRange]);

  if (loading || !data) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading analytics...</div>;
  }

  const { metrics, timeseries, statusDistribution } = data;

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    if (timeRange === '1h' || timeRange === '6h' || timeRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const STATUS_COLORS: Record<string, string> = {
    '200': '#10b981',
    '201': '#10b981',
    '400': '#f59e0b',
    '401': '#f59e0b',
    '403': '#f59e0b',
    '404': '#f59e0b',
    '500': '#ef4444',
    '502': '#ef4444',
    '503': '#ef4444',
    '0': '#64748b' // Network errors
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold tracking-tight">Historical Performance</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last 1 Hour</SelectItem>
            <SelectItem value="6h">Last 6 Hours</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Availability</p>
              <p className="text-2xl font-bold">{metrics.uptime}%</p>
            </div>
            <ActivitySquare className="h-8 w-8 text-emerald-500 opacity-20" />
          </CardContent>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Error Rate</p>
              <p className="text-2xl font-bold">{metrics.errorRate}%</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-rose-500 opacity-20" />
          </CardContent>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">P95 Latency</p>
              <p className="text-2xl font-bold">{metrics.p95Latency}ms</p>
            </div>
            <Zap className="h-8 w-8 text-amber-500 opacity-20" />
          </CardContent>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Checks</p>
              <p className="text-2xl font-bold">{metrics.totalChecks.toLocaleString()}</p>
            </div>
            <Server className="h-8 w-8 text-blue-500 opacity-20" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="col-span-2 lg:col-span-1 border-none shadow-none bg-transparent">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Min Latency</span>
              <span className="font-mono">{metrics.minLatency}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max Latency</span>
              <span className="font-mono">{metrics.maxLatency}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Latency</span>
              <span className="font-mono">{metrics.avgLatency}ms</span>
            </div>
          </div>
        </Card>
        <Card className="col-span-2 lg:col-span-1 border-none shadow-none bg-transparent">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">P50 Latency</span>
              <span className="font-mono">{metrics.p50Latency}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">P95 Latency</span>
              <span className="font-mono">{metrics.p95Latency}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">P99 Latency</span>
              <span className="font-mono">{metrics.p99Latency}ms</span>
            </div>
          </div>
        </Card>
        <Card className="col-span-2 border-none shadow-none bg-transparent">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Total Downtime</span>
              <span className="font-mono text-rose-500">{metrics.totalDowntimeSeconds > 60 ? `${Math.floor(metrics.totalDowntimeSeconds/60)}m ${metrics.totalDowntimeSeconds%60}s` : `${metrics.totalDowntimeSeconds}s`}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Failed Checks</span>
              <span className="font-mono text-rose-500">{metrics.failedChecks.toLocaleString()}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Latency Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Latency Trend (Avg & P95)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeseries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip 
                    labelFormatter={(l) => new Date(l).toLocaleString()}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Line type="monotone" dataKey="avgLatency" name="Avg Latency (ms)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="p95Latency" name="P95 Latency (ms)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Availability Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Availability Trend (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorUptime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip 
                    labelFormatter={(l) => new Date(l).toLocaleString()}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Area type="stepAfter" dataKey="uptime" name="Uptime (%)" stroke="#10b981" fillOpacity={1} fill="url(#colorUptime)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Request Volume Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Check Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeseries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip 
                    labelFormatter={(l) => new Date(l).toLocaleString()}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar dataKey="checkVolume" name="Total Checks" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">HTTP Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="statusCode" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={50} />
                  <RechartsTooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]} barSize={20}>
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.statusCode.toString()] || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
