import { useMemo } from 'react';
import type { Project, Api, Environment, Monitor } from '@/lib/api';

interface ScopeSelectorProps {
  projects: Project[];
  apis: Api[];
  environments: Environment[];
  monitors: Monitor[];
  projectId: string;
  apiId: string;
  environmentId: string;
  monitorId: string;
  onChange: (scope: {
    projectId: string;
    apiId: string;
    environmentId: string;
    monitorId: string;
  }) => void;
  errors?: {
    projectId?: string;
  };
}

export function ScopeSelector({
  projects,
  apis,
  environments,
  monitors,
  projectId,
  apiId,
  environmentId,
  monitorId,
  onChange,
  errors,
}: ScopeSelectorProps) {
  // Cascading filters
  const filteredApis = useMemo(() => {
    if (!projectId) return [];
    return apis.filter((a) => a.projectId === projectId);
  }, [apis, projectId]);

  const filteredEnvironments = useMemo(() => {
    if (apiId) {
      return environments.filter((e) => e.apiId === apiId);
    }
    if (projectId) {
      const projectApiIds = new Set(filteredApis.map((a) => a.id));
      return environments.filter((e) => projectApiIds.has(e.apiId));
    }
    return environments;
  }, [environments, apiId, projectId, filteredApis]);

  const filteredMonitors = useMemo(() => {
    if (environmentId) {
      return monitors.filter((m) => m.environmentId === environmentId);
    }
    if (apiId) {
      const envIds = new Set(filteredEnvironments.map((e) => e.id));
      return monitors.filter((m) => envIds.has(m.environmentId));
    }
    if (projectId) {
      const envIds = new Set(filteredEnvironments.map((e) => e.id));
      return monitors.filter((m) => envIds.has(m.environmentId));
    }
    return monitors;
  }, [monitors, environmentId, apiId, projectId, filteredEnvironments]);

  const handleProjectChange = (newProjId: string) => {
    onChange({
      projectId: newProjId,
      apiId: '',
      environmentId: '',
      monitorId: '',
    });
  };

  const handleApiChange = (newApiId: string) => {
    onChange({
      projectId,
      apiId: newApiId,
      environmentId: '',
      monitorId: '',
    });
  };

  const handleEnvironmentChange = (newEnvId: string) => {
    onChange({
      projectId,
      apiId,
      environmentId: newEnvId,
      monitorId: '',
    });
  };

  const handleMonitorChange = (newMonId: string) => {
    onChange({
      projectId,
      apiId,
      environmentId,
      monitorId: newMonId,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-foreground block mb-1">
          Scope Hierarchy
        </label>
        <p className="text-xs text-muted-foreground mb-3">
          Define the target system boundaries where this alert condition will be evaluated.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Project selection */}
          <div>
            <label className="text-[11px] font-mono text-muted-foreground block mb-1">
              Project <span className="text-destructive">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors?.projectId && (
              <p className="text-[11px] text-destructive mt-1">{errors.projectId}</p>
            )}
          </div>

          {/* API selection */}
          <div>
            <label className="text-[11px] font-mono text-muted-foreground block mb-1">
              API Service
            </label>
            <select
              value={apiId}
              disabled={!projectId}
              onChange={(e) => handleApiChange(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All APIs in Project</option>
              {filteredApis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Environment selection */}
          <div>
            <label className="text-[11px] font-mono text-muted-foreground block mb-1">
              Environment
            </label>
            <select
              value={environmentId}
              disabled={!projectId}
              onChange={(e) => handleEnvironmentChange(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Environments</option>
              {filteredEnvironments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          </div>

          {/* Monitor check selection */}
          <div>
            <label className="text-[11px] font-mono text-muted-foreground block mb-1">
              Monitor Check
            </label>
            <select
              value={monitorId}
              disabled={!projectId}
              onChange={(e) => handleMonitorChange(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Monitors in Scope</option>
              {filteredMonitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.method})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
