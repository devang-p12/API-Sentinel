import type { Project, Api, Environment } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Folder01Icon,
  ApiIcon,
  GlobalIcon,
  Bookmark01Icon,
  FlashIcon,
  Activity01Icon,
  FileImportIcon,
} from '@hugeicons/core-free-icons';

interface EnvironmentVariablesBarProps {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;

  apis: Api[];
  selectedApiId: string;
  onSelectApi: (apiId: string) => void;

  environments: Environment[];
  selectedEnvironmentId: string;
  onSelectEnvironment: (envId: string) => void;

  activeVariables: Record<string, string>;

  onOpenImportCurl: () => void;
  onOpenSaveRequest: () => void;
  onOpenCreateMonitor: () => void;
  onOpenLoadTest: () => void;
}

export function EnvironmentVariablesBar({
  projects,
  selectedProjectId,
  onSelectProject,
  apis,
  selectedApiId,
  onSelectApi,
  environments,
  selectedEnvironmentId,
  onSelectEnvironment,
  activeVariables,
  onOpenImportCurl,
  onOpenSaveRequest,
  onOpenCreateMonitor,
  onOpenLoadTest,
}: EnvironmentVariablesBarProps) {
  const varKeys = Object.keys(activeVariables);

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur-xs px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Left side: Context Selectors (Project, API, Environment) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Project Selector */}
        <div className="flex items-center gap-1.5 bg-background border border-border px-2 py-1 rounded-none">
          <HugeiconsIcon icon={Folder01Icon} className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground font-mono uppercase">Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-transparent font-medium text-foreground text-xs focus:outline-none cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-background text-foreground">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* API Selector */}
        <div className="flex items-center gap-1.5 bg-background border border-border px-2 py-1 rounded-none">
          <HugeiconsIcon icon={ApiIcon} className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground font-mono uppercase">API:</span>
          <select
            value={selectedApiId}
            onChange={(e) => onSelectApi(e.target.value)}
            className="bg-transparent font-medium text-foreground text-xs focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-background text-muted-foreground">
              (Ad-hoc Request)
            </option>
            {apis.map((a) => (
              <option key={a.id} value={a.id} className="bg-background text-foreground">
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Environment Selector */}
        <div className="flex items-center gap-1.5 bg-background border border-border px-2 py-1 rounded-none">
          <HugeiconsIcon icon={GlobalIcon} className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground font-mono uppercase">Env:</span>
          <select
            value={selectedEnvironmentId}
            onChange={(e) => onSelectEnvironment(e.target.value)}
            className="bg-transparent font-medium text-foreground text-xs focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-background text-muted-foreground">
              No Environment
            </option>
            {environments.map((env) => (
              <option key={env.id} value={env.id} className="bg-background text-foreground">
                {env.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active Variables Pills */}
        {varKeys.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 pl-1">
            <span className="text-[10px] text-muted-foreground font-mono">Variables:</span>
            {varKeys.slice(0, 3).map((k) => (
              <Badge
                key={k}
                variant="outline"
                className="font-mono text-[10px] h-5 px-1.5 bg-muted/30 border-border text-foreground truncate max-w-[150px]"
                title={`{{${k}}} = ${activeVariables[k]}`}
              >
                {`{{${k}}}`}
              </Badge>
            ))}
            {varKeys.length > 3 && (
              <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1">
                +{varKeys.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Right side: Quick Action Buttons */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="xs"
          onClick={onOpenImportCurl}
          className="rounded-none gap-1 h-7 text-[11px]"
          title="Import cURL command"
        >
          <HugeiconsIcon icon={FileImportIcon} className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Import cURL</span>
        </Button>

        <Button
          variant="outline"
          size="xs"
          onClick={onOpenSaveRequest}
          className="rounded-none gap-1 h-7 text-[11px]"
          title="Save request to collection (Ctrl+S)"
        >
          <HugeiconsIcon icon={Bookmark01Icon} className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Save</span>
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          variant="outline"
          size="xs"
          onClick={onOpenCreateMonitor}
          className="rounded-none gap-1 h-7 text-[11px]"
          title="Promote this request to a continuous Monitor probe"
        >
          <HugeiconsIcon icon={Activity01Icon} className="size-3.5 text-emerald-500" />
          <span className="hidden md:inline">Create Monitor</span>
        </Button>

        <Button
          variant="outline"
          size="xs"
          onClick={onOpenLoadTest}
          className="rounded-none gap-1 h-7 text-[11px]"
          title="Launch a k6 load test on this endpoint"
        >
          <HugeiconsIcon icon={FlashIcon} className="size-3.5 text-amber-500" />
          <span className="hidden md:inline">Load Test</span>
        </Button>
      </div>
    </div>
  );
}
