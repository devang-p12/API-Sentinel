import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  PlayIcon,
  Delete02Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { LoadTest } from '@/lib/api';
import { LoadTestStatusBadge } from '@/components/load-tests/LoadTestStatusBadge';
import { LoadTestLatencyChart } from '@/components/load-tests/LoadTestLatencyChart';
import { LoadTestThroughputChart } from '@/components/load-tests/LoadTestThroughputChart';
import { LoadTestErrorTable } from '@/components/load-tests/LoadTestErrorTable';

export function LoadTestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loadTest, setLoadTest] = useState<LoadTest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLoadTest = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getLoadTest(id);
      setLoadTest(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load test details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLoadTest();
  }, [fetchLoadTest]);

  // Polling loop while QUEUED or RUNNING
  useEffect(() => {
    if (!loadTest) return;
    if (loadTest.status === 'QUEUED' || loadTest.status === 'RUNNING') {
      const interval = setInterval(() => {
        fetchLoadTest();
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [loadTest?.status, fetchLoadTest]);

  const handleCancel = async () => {
    if (!id) return;
    setIsCancelling(true);
    try {
      await api.cancelLoadTest(id);
      await fetchLoadTest();
    } catch (err: any) {
      alert(`Could not cancel load test: ${err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this load test?')) return;
    setIsDeleting(true);
    try {
      await api.deleteLoadTest(id);
      navigate('/load-tests');
    } catch (err: any) {
      alert(`Could not delete load test: ${err.message}`);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground font-mono">
        Loading test telemetry...
      </div>
    );
  }

  if (error || !loadTest) {
    return (
      <div className="p-8 max-w-xl mx-auto space-y-4 text-center">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-600 dark:text-rose-400 font-mono">
          {error || 'Load test not found.'}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/load-tests')}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-1.5" />
          Back to Load Tests
        </Button>
      </div>
    );
  }

  const result = loadTest.result;
  const samples = loadTest.samples || [];
  const liveProgress = loadTest.liveProgress;

  const isRunning = loadTest.status === 'RUNNING';
  const isQueued = loadTest.status === 'QUEUED';

  // Duration progress calculation if running
  const totalDuration = loadTest.duration || 60;
  const elapsed = liveProgress?.elapsedSeconds || 0;
  const progressPercent =
    loadTest.mode === 'DURATION'
      ? Math.min(100, Math.round((elapsed / totalDuration) * 100))
      : Math.min(
          100,
          Math.round(((liveProgress?.currentRequests || 0) / (loadTest.requestCount || 1)) * 100),
        );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/load-tests')}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-1" />
            Load Tests
          </Button>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {loadTest.name}
            </h1>
            <LoadTestStatusBadge status={loadTest.status} />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {(isQueued || isRunning) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isCancelling}
              className="h-8 text-xs text-rose-500 border-rose-500/20 hover:bg-rose-500/10 font-sans"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5 mr-1.5" />
              {isCancelling ? 'Cancelling...' : 'Cancel Test'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(
                `/load-tests/new?name=${encodeURIComponent(`${loadTest.name} (Copy)`)}`,
              )
            }
            className="h-8 text-xs font-sans"
          >
            <HugeiconsIcon icon={PlayIcon} className="w-3.5 h-3.5 mr-1.5" />
            Re-run / Clone
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
          >
            <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Target Spec Header Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs border border-border/50 rounded-lg bg-card/40 p-3.5 font-mono">
        <div>
          <span className="text-muted-foreground text-[10px] uppercase block">Target Endpoint</span>
          <div className="flex items-center gap-1 mt-0.5 font-semibold text-foreground truncate">
            <span className="px-1 py-0.2 rounded bg-muted/60 text-[10px]">{loadTest.method}</span>
            <span className="truncate">{loadTest.url}</span>
          </div>
        </div>

        <div>
          <span className="text-muted-foreground text-[10px] uppercase block">API / Env</span>
          <span className="text-foreground mt-0.5 block truncate">
            {loadTest.api?.name || 'Custom'} / {loadTest.environment?.name || 'Default'}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground text-[10px] uppercase block">Virtual Users</span>
          <span className="text-foreground mt-0.5 block font-semibold">
            {loadTest.virtualUsers} VUs
          </span>
        </div>

        <div>
          <span className="text-muted-foreground text-[10px] uppercase block">Target Limit</span>
          <span className="text-foreground mt-0.5 block font-semibold">
            {loadTest.mode === 'DURATION'
              ? `${loadTest.duration}s Duration`
              : `${loadTest.requestCount?.toLocaleString()} Requests`}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground text-[10px] uppercase block">Timeout</span>
          <span className="text-foreground mt-0.5 block">{loadTest.timeout}s</span>
        </div>

        <div>
          <span className="text-muted-foreground text-[10px] uppercase block">Started At</span>
          <span className="text-foreground mt-0.5 block truncate">
            {loadTest.startedAt
              ? new Date(loadTest.startedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : 'Pending'}
          </span>
        </div>
      </div>

      {/* Error alert if failed */}
      {loadTest.status === 'FAILED' && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-mono space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <HugeiconsIcon icon={AlertCircleIcon} className="w-4 h-4" /> Load Test Execution Failed
          </div>
          <p className="text-[11px] text-muted-foreground">
            {loadTest.errorMessage || 'Target API could not be reached or connection failed.'}
          </p>
        </div>
      )}

      {/* LIVE PROGRESS CARD (When RUNNING or QUEUED) */}
      {(isQueued || isRunning) && (
        <div className="border border-amber-500/30 rounded-lg bg-amber-500/5 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h2 className="text-sm font-semibold text-foreground font-mono">
                {isQueued ? 'Test Queued — Waiting for Worker...' : 'k6 Execution in Progress'}
              </h2>
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {loadTest.mode === 'DURATION' ? (
                <span>Elapsed: {elapsed}s / {totalDuration}s</span>
              ) : (
                <span>
                  Executed: {(liveProgress?.currentRequests || 0).toLocaleString()} /{' '}
                  {(loadTest.requestCount || 0).toLocaleString()} reqs
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(3, progressPercent)}%` }}
            />
          </div>

          {/* Live Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2 font-mono text-center">
            <div className="border border-border/40 rounded-md p-3 bg-background/50">
              <span className="text-[10px] text-muted-foreground uppercase block">Virtual Users</span>
              <span className="text-lg font-bold text-foreground">
                {liveProgress?.activeUsers ?? loadTest.virtualUsers}
              </span>
            </div>

            <div className="border border-border/40 rounded-md p-3 bg-background/50">
              <span className="text-[10px] text-muted-foreground uppercase block">Requests Executed</span>
              <span className="text-lg font-bold text-foreground">
                {(liveProgress?.currentRequests ?? 0).toLocaleString()}
              </span>
            </div>

            <div className="border border-border/40 rounded-md p-3 bg-background/50">
              <span className="text-[10px] text-muted-foreground uppercase block">Throughput (RPS)</span>
              <span className="text-lg font-bold text-foreground">
                {liveProgress?.currentRps ?? 0}/s
              </span>
            </div>

            <div className="border border-border/40 rounded-md p-3 bg-background/50">
              <span className="text-[10px] text-muted-foreground uppercase block">P95 Latency</span>
              <span className="text-lg font-bold text-foreground">
                {liveProgress?.currentP95 ?? 0}ms
              </span>
            </div>

            <div className="border border-border/40 rounded-md p-3 bg-background/50">
              <span className="text-[10px] text-muted-foreground uppercase block">Error Rate</span>
              <span
                className={`text-lg font-bold ${
                  (liveProgress?.currentErrorRate || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'
                }`}
              >
                {liveProgress?.currentErrorRate ?? 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETED KPI METRIC CARDS */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
          <div className="border border-border/50 rounded-lg p-3.5 bg-card/40">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
              Total Requests
            </span>
            <span className="text-xl font-bold text-foreground mt-1 block">
              {result.totalRequests.toLocaleString()}
            </span>
            <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2">
              <span className="text-emerald-500">{result.successfulRequests.toLocaleString()} ok</span>
              {result.failedRequests > 0 && (
                <span className="text-rose-500">{result.failedRequests.toLocaleString()} fail</span>
              )}
            </div>
          </div>

          <div className="border border-border/50 rounded-lg p-3.5 bg-card/40">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
              Throughput
            </span>
            <span className="text-xl font-bold text-foreground mt-1 block">
              {result.requestsPerSecond}
              <span className="text-xs text-muted-foreground font-normal ml-1">/sec</span>
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              across {result.actualDurationSeconds}s
            </span>
          </div>

          <div className="border border-border/50 rounded-lg p-3.5 bg-card/40">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
              Success Rate
            </span>
            <span className="text-xl font-bold text-emerald-500 mt-1 block">
              {Number((100 - result.errorRate).toFixed(1))}%
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {result.errorRate}% error rate
            </span>
          </div>

          <div className="border border-border/50 rounded-lg p-3.5 bg-card/40">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
              P50 Latency
            </span>
            <span className="text-xl font-bold text-foreground mt-1 block">
              {result.p50Latency}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">ms</span>
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Avg: {result.avgLatency}ms
            </span>
          </div>

          <div className="border border-border/50 rounded-lg p-3.5 bg-card/40">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
              P95 Latency
            </span>
            <span className="text-xl font-bold text-amber-500 mt-1 block">
              {result.p95Latency}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">ms</span>
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              P90: {result.p90Latency}ms
            </span>
          </div>

          <div className="border border-border/50 rounded-lg p-3.5 bg-card/40">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
              P99 Latency
            </span>
            <span className="text-xl font-bold text-rose-500 mt-1 block">
              {result.p99Latency}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">ms</span>
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Max: {result.maxLatency}ms
            </span>
          </div>
        </div>
      )}

      {/* REAL CHARTS SECTION */}
      {samples.length > 0 && (
        <div className="space-y-6">
          <LoadTestLatencyChart samples={samples} />
          <LoadTestThroughputChart samples={samples} />
        </div>
      )}

      {/* ERROR BREAKDOWN SECTION */}
      {result && <LoadTestErrorTable result={result} />}
    </div>
  );
}
