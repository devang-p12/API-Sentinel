import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AnalyticsData } from '@/types/api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell 
} from 'recharts';
import { ActivitySquare, AlertTriangle, Server, Zap, LineChart as LineChartIcon } from 'lucide-react';

export const GlobalAnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [envFilter, setEnvFilter] = useState('all');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let url = `/api/analytics?timeRange=${timeRange}`;
        if (envFilter !== 'all') url += `&environment=${envFilter}`;
        
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch global analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeRange, envFilter]);

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

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    if (timeRange === '1h' || timeRange === '6h' || timeRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header & Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Historical Analytics</h1>
            <p className="text-muted-foreground mt-1">Organization-wide API performance and reliability metrics.</p>
          </div>
          <div className="flex gap-2">
            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[160px]">
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
        </div>

        {loading || !data ? (
          <div className="py-20 text-center animate-pulse">
            <LineChartIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Aggregating analytical data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Global KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-background to-emerald-500/5 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-muted-foreground">Global Availability</p>
                    <ActivitySquare className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-bold">{data.metrics.uptime}%</p>
                    <p className="text-xs text-muted-foreground mt-1">{data.metrics.successfulChecks.toLocaleString()} successful checks</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-background to-rose-500/5 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-muted-foreground">Global Error Rate</p>
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-bold">{data.metrics.errorRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">{data.metrics.failedChecks.toLocaleString()} failed checks</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-background to-blue-500/5 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-muted-foreground">Global Avg Latency</p>
                    <Zap className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-bold">{data.metrics.avgLatency}ms</p>
                    <p className="text-xs text-muted-foreground mt-1">P95: {data.metrics.p95Latency}ms | P99: {data.metrics.p99Latency}ms</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-background to-purple-500/5 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-muted-foreground">Total Request Volume</p>
                    <Server className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-bold">{data.metrics.totalChecks.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">Over {timeRange === '24h' ? '24 hours' : timeRange}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Global Availability Trend</CardTitle>
                  <CardDescription>Average uptime across all services in the selected timeframe</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.timeseries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorGlobalUptime" x1="0" y1="0" x2="0" y2="1">
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
                        <Area type="monotone" dataKey="uptime" name="Uptime (%)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorGlobalUptime)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Global Latency Trend</CardTitle>
                  <CardDescription>P95 and Average response times across all services</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.timeseries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
            </div>

            {/* Charts Row 2 */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Total Volume</CardTitle>
                  <CardDescription>Distribution of monitoring checks across time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.timeseries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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

              <Card>
                <CardHeader>
                  <CardTitle>Global Status Distribution</CardTitle>
                  <CardDescription>Breakdown of all HTTP status codes returned</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.statusDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis dataKey="statusCode" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={50} />
                        <RechartsTooltip 
                          cursor={{fill: 'transparent'}}
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        />
                        <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]} barSize={25}>
                          {data.statusDistribution.map((entry, index) => (
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
        )}
      </div>
    </div>
  );
};

export default GlobalAnalyticsPage;
