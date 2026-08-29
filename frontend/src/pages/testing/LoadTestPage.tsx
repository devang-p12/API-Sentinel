import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/context/ApiContext';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface LoadTestRun {
  id: number;
  apiId: number;
  batchId?: string;
  apiName?: string;
  baseUrl?: string;
  environment?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggerType: 'manual' | 'batch' | 'scheduled';
  virtualUsers: number;
  duration: string;
  startedAt: string;
  completedAt?: string;
  totalRequests?: number;
  successfulRequests?: number;
  failedRequests?: number;
  errorRate?: number;
  throughput?: number;
  avgLatency?: number;
  minLatency?: number;
  maxLatency?: number;
  p50Latency?: number;
  p90Latency?: number;
  p95Latency?: number;
  p99Latency?: number;
  statusCodes?: Record<string, number>;
  errorMessage?: string;
}

interface BatchProgress {
  batchId: string;
  status: 'running' | 'completed' | 'failed';
  totalApis: number;
  completedApis: number;
  successfulApis: number;
  failedApis: number;
  virtualUsers: number;
  duration: string;
  concurrency: number;
  results: Array<{
    apiId: number;
    apiName: string;
    status: 'completed' | 'failed';
    testRunId?: number;
    metrics?: any;
    error?: string;
  }>;
}

interface SchedulerStatus {
  enabled: boolean;
  cronExpression: string;
  virtualUsers: number;
  duration: string;
  concurrency: number;
  isRunning: boolean;
  isJobActive: boolean;
  lastRunAt: string | null;
  lastBatchId: string | null;
  totalScheduledRuns: number;
}

export const LoadTestPage: React.FC = () => {
  const { apis } = useApi();

  // Test Runner Form State
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [virtualUsers, setVirtualUsers] = useState<number>(10);
  const [duration, setDuration] = useState<string>('10s');
  const [concurrency, setConcurrency] = useState<number>(2);

  // Execution State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [activeBatch, setActiveBatch] = useState<BatchProgress | null>(null);
  const [latestResult, setLatestResult] = useState<LoadTestRun | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<LoadTestRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [filterApiId, setFilterApiId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTrigger, setFilterTrigger] = useState<string>('all');

  // Details Modal/Drawer State
  const [selectedRunDetails, setSelectedRunDetails] = useState<LoadTestRun | null>(null);

  // Scheduler Modal State
  const [showSchedulerModal, setShowSchedulerModal] = useState<boolean>(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [schedulerForm, setSchedulerForm] = useState({
    enabled: false,
    cronExpression: '0 0 * * *',
    virtualUsers: 20,
    duration: '15s',
    concurrency: 2,
  });
  const [schedulerMsg, setSchedulerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Select default API if available
  useEffect(() => {
    if (!selectedTarget && apis.length > 0) {
      setSelectedTarget(String(apis[0].id));
    }
  }, [apis, selectedTarget]);

  // Load History
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterApiId !== 'all') params.append('apiId', filterApiId);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterTrigger !== 'all') params.append('triggerType', filterTrigger);

      const res = await fetch(`/api/load-tests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setHistory(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to load load test history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [filterApiId, filterStatus, filterTrigger]);

  // Load Scheduler Status
  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/load-tests/schedule/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setSchedulerStatus(data.data);
          setSchedulerForm({
            enabled: data.data.enabled,
            cronExpression: data.data.cronExpression,
            virtualUsers: data.data.virtualUsers,
            duration: data.data.duration,
            concurrency: data.data.concurrency,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load scheduler status:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchSchedulerStatus();
  }, [fetchHistory, fetchSchedulerStatus]);

  // Timer effect while running
  useEffect(() => {
    if (isRunning) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Batch polling effect
  const pollBatchProgress = useCallback((batchId: string) => {
    if (batchPollRef.current) clearInterval(batchPollRef.current);

    batchPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/load-tests/batch/${batchId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const batchData: BatchProgress = json.data;
            setActiveBatch(batchData);

            if (batchData.status === 'completed' || batchData.status === 'failed') {
              if (batchPollRef.current) clearInterval(batchPollRef.current);
              setIsRunning(false);
              fetchHistory();
            }
          }
        }
      } catch (err) {
        console.error('Error polling batch progress:', err);
      }
    }, 1500);
  }, [fetchHistory]);

  useEffect(() => {
    return () => {
      if (batchPollRef.current) clearInterval(batchPollRef.current);
    };
  }, []);

  // Handle Load Test Execution
  const handleStartTest = async () => {
    if (isRunning) return;
    setExecutionError(null);
    setLatestResult(null);
    setActiveBatch(null);

    const isAll = selectedTarget === 'all';

    // Validate bounds
    if (isAll) {
      if (virtualUsers < 1 || virtualUsers > 1000) {
        setExecutionError('VUs for Batch Run-All must be between 1 and 1,000 per API.');
        return;
      }
    } else {
      if (virtualUsers < 1 || virtualUsers > 5000) {
        setExecutionError('VUs for single API test must be between 1 and 5,000.');
        return;
      }
    }

    setIsRunning(true);

    if (isAll) {
      try {
        const res = await fetch('/api/load-tests/run-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            virtualUsers: Number(virtualUsers),
            duration: duration.trim(),
            concurrency: Number(concurrency),
          }),
        });

        const data = await res.json();
        if (data.success && data.data?.batchId) {
          setActiveBatch({
            batchId: data.data.batchId,
            status: 'running',
            totalApis: data.data.totalApis,
            completedApis: 0,
            successfulApis: 0,
            failedApis: 0,
            virtualUsers: data.data.virtualUsers,
            duration: data.data.duration,
            concurrency: data.data.concurrency,
            results: [],
          });
          pollBatchProgress(data.data.batchId);
        } else {
          setIsRunning(false);
          setExecutionError(data.error?.message || 'Failed to trigger batch load test');
        }
      } catch (err: any) {
        setIsRunning(false);
        setExecutionError(err.message || 'Network error triggering batch load test');
      }
    } else {
      const apiIdNum = parseInt(selectedTarget, 10);
      if (isNaN(apiIdNum) || String(apiIdNum) !== selectedTarget) {
        setIsRunning(false);
        setExecutionError(
          'This API is a local demo entry and has not been registered in the database. ' +
          'Please register it via the APIs page first, then select it here for load testing.'
        );
        return;
      }

      try {
        const res = await fetch('/api/load-tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiId: apiIdNum,
            virtualUsers: Number(virtualUsers),
            duration: duration.trim(),
          }),
        });

        const data = await res.json();
        if (data.success && data.data) {
          setLatestResult(data.data);
          fetchHistory();
        } else {
          setExecutionError(data.error?.message || 'Load test execution failed');
        }
      } catch (err: any) {
        setExecutionError(err.message || 'Network error triggering load test');
      } finally {
        setIsRunning(false);
      }
    }
  };

  // Handle Scheduler Config Save
  const handleSaveScheduler = async () => {
    setSchedulerMsg(null);
    try {
      const res = await fetch('/api/load-tests/schedule/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedulerForm),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setSchedulerStatus(data.data);
        setSchedulerMsg({ type: 'success', text: 'Scheduler configuration saved successfully!' });
        setTimeout(() => setShowSchedulerModal(false), 1200);
      } else {
        setSchedulerMsg({ type: 'error', text: data.error?.message || 'Failed to save schedule settings' });
      }
    } catch (err: any) {
      setSchedulerMsg({ type: 'error', text: err.message || 'Network error saving schedule' });
    }
  };

  const selectedApiObj = apis.find((a) => String(a.id) === selectedTarget);
  const isBatchMode = selectedTarget === 'all';

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* ========================================================================= */}
        {/* Header                                                                    */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-md border bg-muted/40 p-1.5">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Load Testing</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Automated high-concurrency performance and stress testing powered by k6.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchSchedulerStatus();
                setShowSchedulerModal(true);
              }}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              <span>Scheduler</span>
              {schedulerStatus?.enabled && (
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              disabled={historyLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Top Grid: Test Configuration & Live Metrics Panel                         */}
        {/* ========================================================================= */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Form Configuration Card (5 Cols) */}
          <Card className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base font-semibold">Configure Test</CardTitle>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    k6 Engine
                  </Badge>
                </div>
                <CardDescription>
                  Configure virtual user load and duration for targeted performance benchmarks.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                {/* Target API Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Target API</Label>
                  <Select value={selectedTarget} onValueChange={(val) => { if (val) setSelectedTarget(val); }}>
                    <SelectTrigger className="h-9 w-full bg-background text-xs">
                      <SelectValue placeholder="Select target API..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="font-medium text-primary">⚡ All Registered APIs (Batch Mode)</span>
                      </SelectItem>
                      {apis.map((api) => (
                        <SelectItem key={api.id} value={String(api.id)}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{api.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ({api.environment})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedApiObj && !isBatchMode && (
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {selectedApiObj.baseUrl}
                    </p>
                  )}
                </div>

                {/* Virtual Users (VUs) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">
                      Virtual Users (VUs)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {isBatchMode ? 'Max 1,000 / API' : 'Max 5,000 VUs'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={isBatchMode ? 1000 : 5000}
                      value={virtualUsers}
                      onChange={(e) => setVirtualUsers(parseInt(e.target.value, 10) || 1)}
                      className="h-9 font-mono text-xs"
                    />
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[10, 50, 100, 250, 500, 1000, ...(isBatchMode ? [] : [2500, 5000])].map((vu) => (
                      <Button
                        key={vu}
                        type="button"
                        variant={virtualUsers === vu ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setVirtualUsers(vu)}
                      >
                        {vu} VUs
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Test Duration</Label>
                    <span className="text-[11px] text-muted-foreground">e.g. 10s, 30s, 1m</span>
                  </div>

                  <Input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="10s"
                    className="h-9 font-mono text-xs"
                  />

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['5s', '10s', '30s', '1m', '2m', '5m'].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant={duration === d ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setDuration(d)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Concurrency Limit (Batch Mode Only) */}
                {isBatchMode && (
                  <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">API Concurrency Limit</Label>
                      <span className="font-mono text-xs font-semibold">{concurrency} parallel</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Controls how many APIs are load-tested simultaneously to prevent downstream overload.
                    </p>
                    <div className="flex gap-1.5 pt-1">
                      {[1, 2, 3, 5, 8].map((c) => (
                        <Button
                          key={c}
                          type="button"
                          variant={concurrency === c ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setConcurrency(c)}
                        >
                          {c} workers
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {executionError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-red-600 dark:text-red-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-xs">{executionError}</p>
                  </div>
                )}
              </CardContent>
            </div>

            {/* Launch Button */}
            <div className="p-6 pt-0">
              <Button
                onClick={handleStartTest}
                disabled={isRunning}
                className="h-10 w-full gap-2 font-medium"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Executing ({elapsedTime}s elapsed)...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>{isBatchMode ? 'Launch Batch Load Test' : 'Run Load Test'}</span>
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Results / Live Metric View (7 Cols) */}
          <Card className="lg:col-span-7 flex flex-col justify-between">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">Test Performance Results</CardTitle>
                </div>
                {isRunning && (
                  <Badge variant="outline" className="animate-pulse border-amber-500/30 bg-amber-500/10 text-amber-600">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Running ({elapsedTime}s)
                  </Badge>
                )}
                {!isRunning && latestResult && (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
                  </Badge>
                )}
              </div>
              <CardDescription>
                Detailed metric breakdown: request throughput, latency distribution percentiles, and error rate.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 space-y-6 pt-0">
              {/* State 1: Active Batch Execution */}
              {activeBatch && (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Batch Run: {activeBatch.batchId}</p>
                      <p className="text-xs text-muted-foreground">
                        Testing {activeBatch.totalApis} APIs with {activeBatch.virtualUsers} VUs each ({activeBatch.concurrency} parallel workers)
                      </p>
                    </div>
                    <Badge variant="outline" className={activeBatch.status === 'completed' ? 'border-emerald-500/30 text-emerald-600' : 'border-blue-500/30 text-blue-600'}>
                      {activeBatch.completedApis} / {activeBatch.totalApis} Done
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.round((activeBatch.completedApis / (activeBatch.totalApis || 1)) * 100)}%`,
                      }}
                    />
                  </div>

                  {/* Batch API items */}
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {activeBatch.results.map((res, i) => (
                      <div key={i} className="flex items-center justify-between rounded border bg-background p-2 text-xs">
                        <div className="flex items-center gap-2">
                          {res.status === 'completed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className="font-medium">{res.apiName}</span>
                        </div>
                        {res.metrics && (
                          <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                            <span>{res.metrics.throughput} rps</span>
                            <span>{res.metrics.avgLatency}ms avg</span>
                            <span className={res.metrics.errorRate > 0 ? 'text-red-500' : 'text-emerald-500'}>
                              {res.metrics.errorRate}% err
                            </span>
                          </div>
                        )}
                        {res.error && (
                          <span className="truncate max-w-[180px] text-[11px] text-red-500">
                            {res.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* State 2: Single Test Result Ready */}
              {latestResult && !activeBatch && (
                <div className="space-y-6">
                  {/* Metric Cards Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {/* Throughput */}
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[11px] text-muted-foreground">Throughput (RPS)</p>
                      <p className="mt-1 text-2xl font-bold tracking-tight">{latestResult.throughput ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">req/sec</p>
                    </div>

                    {/* Total Requests */}
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[11px] text-muted-foreground">Total Requests</p>
                      <p className="mt-1 text-2xl font-bold tracking-tight">{latestResult.totalRequests ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {latestResult.successfulRequests ?? 0} ok &middot; {latestResult.failedRequests ?? 0} fail
                      </p>
                    </div>

                    {/* Average Latency */}
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[11px] text-muted-foreground">Avg Latency</p>
                      <p className="mt-1 text-2xl font-bold tracking-tight">{latestResult.avgLatency ?? 0}ms</p>
                      <p className="text-[10px] text-muted-foreground">
                        min {latestResult.minLatency ?? 0}ms &middot; max {latestResult.maxLatency ?? 0}ms
                      </p>
                    </div>

                    {/* Error Rate */}
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[11px] text-muted-foreground">Error Rate</p>
                      <p className={`mt-1 text-2xl font-bold tracking-tight ${Number(latestResult.errorRate) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {latestResult.errorRate ?? 0}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">HTTP failures</p>
                    </div>
                  </div>

                  {/* Latency Percentiles */}
                  <div className="rounded-lg border bg-muted/10 p-4">
                    <p className="mb-3 text-xs font-semibold">Latency Distribution Percentiles</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="rounded border bg-background p-2">
                        <p className="text-[10px] text-muted-foreground">p50 (Median)</p>
                        <p className="font-mono text-sm font-semibold">{latestResult.p50Latency ?? 0}ms</p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-[10px] text-muted-foreground">p90</p>
                        <p className="font-mono text-sm font-semibold">{latestResult.p90Latency ?? 0}ms</p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-[10px] text-muted-foreground">p95</p>
                        <p className="font-mono text-sm font-semibold">{latestResult.p95Latency ?? 0}ms</p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-[10px] text-muted-foreground">p99</p>
                        <p className="font-mono text-sm font-semibold">{latestResult.p99Latency ?? 0}ms</p>
                      </div>
                    </div>
                  </div>

                  {/* Status Code Distribution */}
                  {latestResult.statusCodes && (
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-medium text-muted-foreground">HTTP Status Distribution:</span>
                      {Object.entries(latestResult.statusCodes).map(([code, count]) => (
                        <Badge key={code} variant="secondary" className="gap-1 font-mono text-[11px]">
                          <span>{code}:</span>
                          <span className="font-bold">{count}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* State 3: Idle / No Run Yet */}
              {!latestResult && !activeBatch && !isRunning && (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                  <div className="rounded-full border bg-muted/30 p-4">
                    <Layers className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Ready to execute load test</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                      Choose an individual API or batch mode, set virtual user count and duration, then start the test.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* Historical Load Test Runs Table                                           */}
        {/* ========================================================================= */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Load Test History</CardTitle>
                <CardDescription>
                  Historical performance records and benchmark audit logs for all registered APIs.
                </CardDescription>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterApiId} onValueChange={(val) => { if (val) setFilterApiId(val); }}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="Filter by API" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All APIs</SelectItem>
                    {apis.map((api) => (
                      <SelectItem key={api.id} value={String(api.id)}>
                        {api.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={(val) => { if (val) setFilterStatus(val); }}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterTrigger} onValueChange={(val) => { if (val) setFilterTrigger(val); }}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue placeholder="Trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Triggers</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="batch">Batch</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Run ID / Trigger</TableHead>
                    <TableHead>API Target</TableHead>
                    <TableHead>VUs / Duration</TableHead>
                    <TableHead>Throughput</TableHead>
                    <TableHead>Avg Latency</TableHead>
                    <TableHead>p95 Latency</TableHead>
                    <TableHead>Error Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                        {historyLoading ? 'Loading load test history...' : 'No historical load tests found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((run) => (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedRunDetails(run)}
                      >
                        <TableCell className="pl-6 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span>#{run.id}</span>
                            <Badge
                              variant="outline"
                              className={
                                run.triggerType === 'scheduled'
                                  ? 'border-purple-500/30 bg-purple-500/10 text-purple-600 text-[10px]'
                                  : run.triggerType === 'batch'
                                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 text-[10px]'
                                  : 'border-slate-500/30 bg-slate-500/10 text-slate-600 text-[10px]'
                              }
                            >
                              {run.triggerType}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-medium text-xs">{run.apiName || `API #${run.apiId}`}</p>
                            <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
                              {run.baseUrl || ''}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {run.virtualUsers} VUs &middot; {run.duration}
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {run.throughput != null ? `${run.throughput} rps` : '-'}
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {run.avgLatency != null ? `${run.avgLatency}ms` : '-'}
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {run.p95Latency != null ? `${run.p95Latency}ms` : '-'}
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {run.errorRate != null ? (
                            <span className={Number(run.errorRate) > 0 ? 'text-red-500 font-semibold' : 'text-emerald-500'}>
                              {run.errorRate}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>

                        <TableCell>
                          {run.status === 'completed' && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[10px]">
                              Completed
                            </Badge>
                          )}
                          {run.status === 'failed' && (
                            <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600 text-[10px]">
                              Failed
                            </Badge>
                          )}
                          {run.status === 'running' && (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-[10px]">
                              Running
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}
                        </TableCell>

                        <TableCell className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setSelectedRunDetails(run)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* Run Details Modal / Dialog                                                */}
      {/* ========================================================================= */}
      {selectedRunDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl border bg-background p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-semibold">Load Test Run Details #{selectedRunDetails.id}</h3>
                <p className="text-xs text-muted-foreground">
                  Target: {selectedRunDetails.apiName} ({selectedRunDetails.baseUrl})
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedRunDetails(null)}>
                ✕
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded border p-3 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Virtual Users</p>
                <p className="text-lg font-bold">{selectedRunDetails.virtualUsers} VUs</p>
              </div>
              <div className="rounded border p-3 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Duration</p>
                <p className="text-lg font-bold">{selectedRunDetails.duration}</p>
              </div>
              <div className="rounded border p-3 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Throughput</p>
                <p className="text-lg font-bold">{selectedRunDetails.throughput ?? 0} rps</p>
              </div>
              <div className="rounded border p-3 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Error Rate</p>
                <p className={`text-lg font-bold ${Number(selectedRunDetails.errorRate) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {selectedRunDetails.errorRate ?? 0}%
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/10 p-4">
              <p className="text-xs font-semibold">Latency Breakdown</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                <div className="rounded border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">Min</p>
                  <p className="font-mono font-semibold">{selectedRunDetails.minLatency ?? 0}ms</p>
                </div>
                <div className="rounded border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">Avg</p>
                  <p className="font-mono font-semibold">{selectedRunDetails.avgLatency ?? 0}ms</p>
                </div>
                <div className="rounded border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">p50</p>
                  <p className="font-mono font-semibold">{selectedRunDetails.p50Latency ?? 0}ms</p>
                </div>
                <div className="rounded border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">p90</p>
                  <p className="font-mono font-semibold">{selectedRunDetails.p90Latency ?? 0}ms</p>
                </div>
                <div className="rounded border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">p95</p>
                  <p className="font-mono font-semibold">{selectedRunDetails.p95Latency ?? 0}ms</p>
                </div>
                <div className="rounded border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">p99</p>
                  <p className="font-mono font-semibold">{selectedRunDetails.p99Latency ?? 0}ms</p>
                </div>
              </div>
            </div>

            {selectedRunDetails.errorMessage && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
                <p className="font-semibold">Error Message:</p>
                <p className="mt-1 font-mono">{selectedRunDetails.errorMessage}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedRunDetails(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Scheduler Modal                                                           */}
      {/* ========================================================================= */}
      {showSchedulerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border bg-background p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Scheduled Periodic Load Testing</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowSchedulerModal(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Enable Switch */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3.5">
                <div>
                  <Label className="text-sm font-medium">Enable Autonomous Testing</Label>
                  <p className="text-muted-foreground mt-0.5">
                    Automatically benchmarks all active APIs in the background without needing a user session.
                  </p>
                </div>
                <Switch
                  checked={schedulerForm.enabled}
                  onCheckedChange={(checked) => setSchedulerForm((prev) => ({ ...prev, enabled: checked }))}
                />
              </div>

              {/* Cron Schedule (Minimum 24h Interval Rule) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Execution Schedule (Cron Expression)</Label>
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-600">
                    Min 24h Interval
                  </Badge>
                </div>

                <Select
                  value={schedulerForm.cronExpression}
                  onValueChange={(val) => {
                    if (val) {
                      setSchedulerForm((prev) => ({ ...prev, cronExpression: val }));
                    }
                  }}
                >
                  <SelectTrigger className="h-9 font-mono text-xs">
                    <SelectValue placeholder="Select frequency..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0 0 * * *">Every Day at Midnight (0 0 * * *)</SelectItem>
                    <SelectItem value="0 6 * * *">Every Day at 6:00 AM (0 6 * * *)</SelectItem>
                    <SelectItem value="0 12 * * *">Every Day at 12:00 PM (0 12 * * *)</SelectItem>
                    <SelectItem value="0 0 * * 0">Every Sunday at Midnight (0 0 * * 0)</SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-[11px] text-muted-foreground">
                  Scheduled testing runs are strictly enforced to execute at most once per 24 hours to prevent unnecessary target load.
                </p>
              </div>

              {/* Scheduled VU & Duration */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Virtual Users (1 - 500)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={schedulerForm.virtualUsers}
                    onChange={(e) =>
                      setSchedulerForm((prev) => ({ ...prev, virtualUsers: parseInt(e.target.value, 10) || 10 }))
                    }
                    className="h-8 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Duration</Label>
                  <Input
                    type="text"
                    value={schedulerForm.duration}
                    onChange={(e) => setSchedulerForm((prev) => ({ ...prev, duration: e.target.value }))}
                    className="h-8 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Concurrency Limit</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={schedulerForm.concurrency}
                    onChange={(e) =>
                      setSchedulerForm((prev) => ({ ...prev, concurrency: parseInt(e.target.value, 10) || 2 }))
                    }
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Status Message */}
              {schedulerMsg && (
                <div
                  className={`rounded-md p-2.5 text-xs ${
                    schedulerMsg.type === 'success'
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                      : 'border border-red-500/30 bg-red-500/10 text-red-600'
                  }`}
                >
                  {schedulerMsg.text}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-[11px] text-muted-foreground">
                {schedulerStatus?.lastRunAt
                  ? `Last scheduled run: ${new Date(schedulerStatus.lastRunAt).toLocaleString()}`
                  : 'No scheduled runs yet'}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSchedulerModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveScheduler}>
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadTestPage;
