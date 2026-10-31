import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Search01Icon,
  RefreshIcon,
  Activity01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { LoadTest, LoadTestStatus, Api } from '@/lib/api';
import { LoadTestStatusBadge } from '@/components/load-tests/LoadTestStatusBadge';

export function LoadTestsListPage() {
  const navigate = useNavigate();

  const [tests, setTests] = useState<LoadTest[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [apiFilter, setApiFilter] = useState<string>('ALL');

  const fetchTests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getLoadTests({
        status: statusFilter !== 'ALL' ? (statusFilter as LoadTestStatus) : undefined,
        apiId: apiFilter !== 'ALL' ? apiFilter : undefined,
        search: search.trim() || undefined,
      });
      setTests(data.items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load historical load tests.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, apiFilter, search]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  // Load APIs for filter dropdown
  useEffect(() => {
    async function loadApis() {
      try {
        const projs = await api.getProjects();
        const allApis: Api[] = [];
        for (const p of projs) {
          if (p.apis) {
            allApis.push(...p.apis);
          }
        }
        setApis(allApis);
      } catch {}
    }
    loadApis();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Load Tests
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Targeted concurrency benchmarks, stress testing, and latency profiles via k6
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTests}
            className="h-8 px-2.5 text-xs font-sans text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={RefreshIcon} className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/load-tests/new')}
            className="h-8 px-3 text-xs font-sans font-medium"
          >
            <HugeiconsIcon icon={Add01Icon} className="w-3.5 h-3.5 mr-1.5" />
            Create Load Test
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <HugeiconsIcon
            icon={Search01Icon}
            className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by test name or URL..."
            className="h-8 text-xs pl-8 font-sans"
          />
        </div>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 px-2.5 text-xs bg-background border border-border rounded-md font-sans text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">Status: All</option>
          <option value="QUEUED">Queued</option>
          <option value="RUNNING">Running</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* API Dropdown */}
        <select
          value={apiFilter}
          onChange={(e) => setApiFilter(e.target.value)}
          className="h-8 px-2.5 text-xs bg-background border border-border rounded-md font-sans text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">API: All</option>
          {apis.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-600 dark:text-rose-400 font-mono">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="border border-border/50 rounded-lg bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/30 border-b border-border/40 font-mono text-[11px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Load Test</th>
                <th className="px-4 py-2.5 font-medium">API</th>
                <th className="px-4 py-2.5 font-medium">Environment</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Duration / Limit</th>
                <th className="px-4 py-2.5 font-medium text-right">VUs</th>
                <th className="px-4 py-2.5 font-medium text-right">Requests</th>
                <th className="px-4 py-2.5 font-medium text-right">P95</th>
                <th className="px-4 py-2.5 font-medium text-right">Success Rate</th>
                <th className="px-4 py-2.5 font-medium text-right">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading && tests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground font-mono">
                    Loading historical load tests...
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-full bg-muted/50 border border-border flex items-center justify-center mx-auto text-muted-foreground">
                        <HugeiconsIcon icon={Activity01Icon} className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-sm text-foreground">No load tests yet</h3>
                        <p className="text-xs text-muted-foreground">
                          Run a load test against an API to measure throughput, latency, success rate, and errors.
                        </p>
                      </div>
                      <div className="pt-1">
                        <Button
                          size="sm"
                          onClick={() => navigate('/load-tests/new')}
                          className="h-8 text-xs font-medium"
                        >
                          <HugeiconsIcon icon={Add01Icon} className="w-3.5 h-3.5 mr-1.5" />
                          Create Load Test
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                tests.map((test) => {
                  const res = test.result;
                  const successRate = res
                    ? `${Number((100 - res.errorRate).toFixed(1))}%`
                    : '—';
                  const p95Text = res ? `${res.p95Latency}ms` : '—';
                  const totalReqs = res ? res.totalRequests.toLocaleString() : '—';

                  const durationText =
                    test.mode === 'DURATION'
                      ? `${test.duration || 60}s`
                      : `${test.requestCount?.toLocaleString()} reqs`;

                  return (
                    <tr
                      key={test.id}
                      onClick={() => navigate(`/load-tests/${test.id}`)}
                      className="hover:bg-muted/15 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold hover:underline">{test.name}</span>
                          <span className="px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground font-mono text-[10px]">
                            {test.method}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate max-w-xs mt-0.5">
                          {test.url}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {test.api?.name || '—'}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                        {test.environment?.name || '—'}
                      </td>

                      <td className="px-4 py-3">
                        <LoadTestStatusBadge status={test.status} />
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {durationText}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                        {test.virtualUsers}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {totalReqs}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-foreground font-medium">
                        {p95Text}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {res ? (
                          <span
                            className={
                              res.errorRate > 0 ? 'text-amber-500' : 'text-emerald-500'
                            }
                          >
                            {successRate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-[11px] text-muted-foreground">
                        {test.startedAt
                          ? new Date(test.startedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : new Date(test.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
