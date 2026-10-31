import type { LoadTestResult } from '@/lib/api';

interface LoadTestErrorTableProps {
  result: LoadTestResult;
  className?: string;
}

export function LoadTestErrorTable({ result, className = '' }: LoadTestErrorTableProps) {
  const total = result.totalRequests || 1;
  const statusCodes = result.statusCodeCounts || {};

  // Build rows for each HTTP status code
  const codeEntries = Object.entries(statusCodes)
    .map(([code, count]) => {
      const c = Number(count);
      const codeNum = parseInt(code, 10);
      let category = 'Success';
      let badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

      if (codeNum >= 300 && codeNum < 400) {
        category = 'Redirection';
        badgeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      } else if (codeNum >= 400 && codeNum < 500) {
        category = 'Client Error';
        badgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      } else if (codeNum >= 500) {
        category = 'Server Error';
        badgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      }

      return {
        key: `http-${code}`,
        type: `HTTP ${code}`,
        category,
        count: c,
        percentage: Number(((c / total) * 100).toFixed(1)),
        badgeClass,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Network anomalies (timeouts & connection errors)
  const anomalies: Array<{
    key: string;
    type: string;
    category: string;
    count: number;
    percentage: number;
    badgeClass: string;
  }> = [];

  if (result.timeoutCount > 0) {
    anomalies.push({
      key: 'timeouts',
      type: 'Request Timeout',
      category: 'Network / Gateway',
      count: result.timeoutCount,
      percentage: Number(((result.timeoutCount / total) * 100).toFixed(1)),
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    });
  }

  if (result.connectionErrors > 0) {
    anomalies.push({
      key: 'conn-errors',
      type: 'Connection Refused / DNS',
      category: 'Network Failure',
      count: result.connectionErrors,
      percentage: Number(((result.connectionErrors / total) * 100).toFixed(1)),
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    });
  }

  const allRows = [...codeEntries, ...anomalies];

  return (
    <div className={`border border-border/50 rounded-lg bg-card/40 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-border/40">
        <h3 className="font-medium text-foreground text-sm">HTTP Status & Error Breakdown</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Distribution of response status codes and connection failures across {total.toLocaleString()} requests
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/30 border-b border-border/40 font-mono text-[11px] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Status / Error Type</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium text-right">Count</th>
              <th className="px-4 py-2.5 font-medium text-right">Percentage</th>
              <th className="px-4 py-2.5 font-medium w-48">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20 font-mono">
            {allRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground font-sans">
                  No status code breakdown available
                </td>
              </tr>
            ) : (
              allRows.map((row) => (
                <tr key={row.key} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-mono ${row.badgeClass}`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-sans">{row.category}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {row.percentage}%
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          row.category === 'Success'
                            ? 'bg-emerald-500'
                            : row.category === 'Client Error'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(1, row.percentage))}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
