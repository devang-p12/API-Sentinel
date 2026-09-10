import React, { useState, useEffect, useMemo } from 'react';
import { GitCompare, AlertTriangle, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import { useApi } from '@/context/ApiContext';
import { fetchEnvComparison } from '@/services/analytics.service';
import type { EnvComparisonData } from '@/services/analytics.service';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export const EnvComparisonPage: React.FC = () => {
  const { apis } = useApi();
  const [selectedApiName, setSelectedApiName] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [data, setData] = useState<EnvComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uniqueApiNames = useMemo(() => {
    return Array.from(new Set(apis.map(a => a.name))).sort();
  }, [apis]);

  useEffect(() => {
    if (!selectedApiName && uniqueApiNames.length > 0) {
      setSelectedApiName(uniqueApiNames[0]);
    }
  }, [uniqueApiNames, selectedApiName]);

  useEffect(() => {
    if (!selectedApiName) return;

    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEnvComparison(selectedApiName, timeRange);
        if (mounted) {
          setData(result);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load comparison data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [selectedApiName, timeRange]);

  const generateInsights = () => {
    if (!data || Object.keys(data.environments).length < 2) return [];
    
    const insights: React.ReactNode[] = [];
    const envs = Object.keys(data.environments);
    
    // Find base environment (prefer development, then staging)
    let baseEnv = envs.find(e => e.toLowerCase().includes('dev'));
    if (!baseEnv) baseEnv = envs.find(e => e.toLowerCase().includes('stag'));
    if (!baseEnv) baseEnv = envs[0];

    const prodEnv = envs.find(e => e.toLowerCase().includes('prod'));
    
    if (baseEnv && prodEnv && baseEnv !== prodEnv) {
      const baseStats = data.environments[baseEnv];
      const prodStats = data.environments[prodEnv];

      // Latency comparison
      if (baseStats.avgLatency > 0) {
        const ratio = prodStats.avgLatency / baseStats.avgLatency;
        if (ratio >= 2) {
          insights.push(
            <span key="lat-high" className="text-destructive font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {prodEnv} latency is {ratio.toFixed(1)}x higher than {baseEnv}.
            </span>
          );
        } else if (ratio <= 0.5) {
          insights.push(
            <span key="lat-low" className="text-green-500 font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              {prodEnv} latency is {(1 / ratio).toFixed(1)}x faster than {baseEnv}.
            </span>
          );
        }
      }

      // Error rate comparison
      if (prodStats.errorRate > baseStats.errorRate + 1) {
         insights.push(
            <span key="err-high" className="text-destructive font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {prodEnv} error rate ({prodStats.errorRate.toFixed(1)}%) is significantly higher than {baseEnv} ({baseStats.errorRate.toFixed(1)}%).
            </span>
         );
      }

      // Schema comparison
      if (prodStats.schemaVersion !== baseStats.schemaVersion) {
        insights.push(
            <span key="schema-diff" className="text-amber-500 font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              {prodEnv} schema (v{prodStats.schemaVersion}) differs from {baseEnv} (v{baseStats.schemaVersion}).
            </span>
        );
      }
    }
    
    if (insights.length === 0) {
      insights.push(<span key="no-diff" className="text-muted-foreground">Environments are performing similarly. No significant anomalies detected.</span>);
    }
    
    return insights;
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    // Transform environments into an array for bar chart
    return Object.entries(data.environments).map(([env, stats]) => ({
      name: env,
      avgLatency: stats.avgLatency,
      p95Latency: stats.p95Latency,
      errorRate: stats.errorRate,
      volume: stats.requestVolume
    }));
  }, [data]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Environment Comparison</h1>
          <p className="text-muted-foreground">Compare performance, schemas, and reliability across environments.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedApiName} 
            onChange={e => setSelectedApiName(e.target.value)}
            className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {uniqueApiNames.length === 0 && <option value="">No APIs Found</option>}
            {uniqueApiNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          
          <select 
            value={timeRange} 
            onChange={e => setTimeRange(e.target.value)}
            className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="1h">Last 1 Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <button
            onClick={() => setData({ ...data } as any)} // Trigger a fake reload/re-render to show loading state if we want, or just let React handle it.
            className="p-2 border rounded-md hover:bg-accent"
            title="Refresh Data"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-4 text-destructive rounded-md">
          <p className="font-semibold">Error loading comparison</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Insights Panel */}
          <div className="bg-card border rounded-lg p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ZapIcon className="h-5 w-5 text-yellow-500" />
              Automated Insights
            </h3>
            <div className="flex flex-col gap-2">
              {generateInsights()}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart: Latency */}
            <div className="bg-card border rounded-lg p-5 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Latency Comparison (ms)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
                    <Legend />
                    <Bar dataKey="avgLatency" name="Avg Latency" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="p95Latency" name="P95 Latency" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart: Error Rates */}
            <div className="bg-card border rounded-lg p-5 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Error Rate (%)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
                    <Bar dataKey="errorRate" name="Error Rate %" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                   <tr>
                     <th className="px-6 py-3 font-semibold">Metric</th>
                     {Object.keys(data.environments).map(env => (
                       <th key={env} className="px-6 py-3 font-semibold">{env}</th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">Health Status</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">
                           <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stats.health === 'HEALTHY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                             {stats.health}
                           </span>
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">Availability</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">{stats.availability.toFixed(2)}%</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">Average Latency</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">{stats.avgLatency} ms</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">P50 Latency</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">{stats.p50Latency} ms</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">P95 Latency</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">{stats.p95Latency} ms</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">P99 Latency</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">{stats.p99Latency} ms</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">Error Rate</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">{stats.errorRate.toFixed(2)}%</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">Request Volume</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">{stats.requestVolume}</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">Schema Version</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">v{stats.schemaVersion}</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">Active Incidents</td>
                      {Object.values(data.environments).map((stats, i) => (
                        <td key={i} className="px-6 py-4">
                           {stats.recentIncidents > 0 ? (
                              <span className="text-destructive font-bold">{stats.recentIncidents}</span>
                           ) : (
                              <span className="text-muted-foreground">{stats.recentIncidents}</span>
                           )}
                        </td>
                      ))}
                    </tr>
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ZapIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);
