import React, { useState } from 'react';
import { useApi } from '../context/ApiContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  X, 
  Trash2, 
  ExternalLink, 
  Copy, 
  Check, 
  Activity, 
  Lock, 
  Clock, 
  Tag, 
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export const ApiDetails: React.FC = () => {
  const { 
    apis, 
    selectedApiId, 
    setSelectedApiId, 
    deleteApi, 
    updateApi,
    updateMonitoringConfig
  } = useApi();

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAuth, setCopiedAuth] = useState(false);

  // Find selected API
  const api = apis.find(item => item.id === selectedApiId);

  if (!selectedApiId) return null;

  const handleClose = () => {
    setSelectedApiId(null);
  };

  if (!api) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full p-6 shadow-xl flex flex-col justify-center items-center gap-4">
          <p className="text-xs text-slate-400">Selected API not found.</p>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Close panel
          </Button>
        </div>
      </div>
    );
  }

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${api.name}?`)) {
      deleteApi(api.id);
      setSelectedApiId(null);
    }
  };

  const handleToggleStatus = () => {
    updateApi(api.id, {
      status: api.status === 'Active' ? 'Inactive' : 'Active'
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/20 dark:bg-black/40 backdrop-blur-xs flex justify-end z-50 fade-in">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* Slide-over Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 h-full shadow-lg flex flex-col justify-between z-10 transition-transform duration-300">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-md font-bold text-slate-900 dark:text-slate-50 m-0">
                {api.name}
              </h2>
              <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800">
                {api.version}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
              Group: <span className="font-semibold text-slate-500 dark:text-slate-350">{api.group}</span>
            </span>
          </div>
          <button 
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-850"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5 text-left">
          
          {/* Quick Badges */}
          <div className="flex items-center gap-3">
            <Badge variant={api.environment.toLowerCase() as any}>
              {api.environment}
            </Badge>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${api.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="font-semibold text-[10px] text-slate-700 dark:text-slate-350 uppercase tracking-widest">
                {api.status}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Description
            </span>
            <p className="text-xs text-slate-655 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-md border border-slate-150 dark:border-slate-850">
              {api.description || 'No description provided.'}
            </p>
          </div>

          {/* Configuration Parameters */}
          <div className="space-y-2">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Configuration Details
            </span>
            <div className="p-3 rounded-md border bg-transparent border-slate-200 dark:border-slate-800 space-y-2.5">
              
              {/* Base URL */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Base URL
                </span>
                <div className="flex items-center justify-between gap-2 bg-slate-50/30 dark:bg-slate-950 px-2 py-1 rounded border border-slate-150 dark:border-slate-850 font-mono text-[10px] text-slate-655 dark:text-slate-300">
                  <span className="break-all">{api.baseUrl}</span>
                  <button 
                    onClick={() => handleCopy(api.baseUrl, setCopiedUrl)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedUrl ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Documentation link */}
              {api.documentationUrl && (
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Documentation
                  </span>
                  <a
                    href={api.documentationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-slate-800 hover:text-black dark:text-slate-300 dark:hover:text-white font-semibold underline"
                  >
                    <span>Open API Docs</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}

              {/* Created Time */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-850 text-[11px]">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={11} /> Registered
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {new Date(api.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Continuous Monitoring Settings */}
          <div className="space-y-2">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Continuous Monitoring
            </span>
            <div className="p-3 rounded-md border bg-transparent border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Activity size={12} /> Enable Background Polling
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2 border-slate-200 dark:border-slate-800"
                  onClick={() => {
                    if (updateMonitoringConfig) {
                      updateMonitoringConfig(api.id, {
                        monitoringEnabled: !api.monitoringEnabled,
                        monitoringInterval: api.monitoringInterval || 60,
                        timeout: api.timeout || 5000,
                        degradedThresholdMs: api.degradedThresholdMs || 1000
                      });
                    }
                  }}
                >
                  {api.monitoringEnabled ? (
                    <span className="text-emerald-500 flex items-center gap-1"><ToggleRight size={12} /> ON</span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1"><ToggleLeft size={12} /> OFF</span>
                  )}
                </Button>
              </div>

              {api.monitoringEnabled && (
                <div className="pt-2 border-t border-slate-150 dark:border-slate-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-400">Current Health</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] border ${
                      api.healthStatus === 'DOWN' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                      api.healthStatus === 'DEGRADED' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    }`}>
                      {api.healthStatus || 'HEALTHY'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 block mb-0.5">Interval (s)</span>
                      <input 
                        type="number"
                        className="w-full bg-slate-50 dark:bg-slate-950 px-1.5 py-1 rounded border border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[10px]"
                        value={api.monitoringInterval || 60}
                        onChange={(e) => updateMonitoringConfig(api.id, {
                          monitoringEnabled: true,
                          monitoringInterval: parseInt(e.target.value) || 60,
                          timeout: api.timeout || 5000,
                          degradedThresholdMs: api.degradedThresholdMs || 1000
                        })}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block mb-0.5">Timeout (ms)</span>
                      <input 
                        type="number"
                        className="w-full bg-slate-50 dark:bg-slate-950 px-1.5 py-1 rounded border border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[10px]"
                        value={api.timeout || 5000}
                        onChange={(e) => updateMonitoringConfig(api.id, {
                          monitoringEnabled: true,
                          monitoringInterval: api.monitoringInterval || 60,
                          timeout: parseInt(e.target.value) || 5000,
                          degradedThresholdMs: api.degradedThresholdMs || 1000
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">Degraded Threshold (ms)</span>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 dark:bg-slate-950 px-1.5 py-1 rounded border border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[10px]"
                      value={api.degradedThresholdMs || 1000}
                      onChange={(e) => updateMonitoringConfig(api.id, {
                        monitoringEnabled: true,
                        monitoringInterval: api.monitoringInterval || 60,
                        timeout: api.timeout || 5000,
                        degradedThresholdMs: parseInt(e.target.value) || 1000
                      })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Authentication configuration */}
          <div className="space-y-2">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Security Credentials
            </span>
            <div className="p-3 rounded-md border bg-transparent border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Lock size={11} /> Authentication
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {api.authType}
                </span>
              </div>

              {api.authType !== 'None' && api.authConfig && (
                <div className="pt-2 border-t border-slate-150 dark:border-slate-850 space-y-2 text-xs">
                  
                  {/* API Key */}
                  {api.authType === 'API Key' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block">Header Name</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{api.authConfig.apiHeaderName || 'X-API-Key'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block">Key Name</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{api.authConfig.apiKeyName || 'Authorization'}</span>
                      </div>
                    </div>
                  )}

                  {/* Bearer Token */}
                  {api.authType === 'Bearer Token' && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">Token value</span>
                      <div className="flex items-center justify-between gap-1.5 bg-slate-50/30 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-150 dark:border-slate-850 font-mono text-[9px] text-slate-500 truncate max-w-full">
                        <span className="truncate">{api.authConfig.tokenValue || '••••••••••••'}</span>
                        <button
                          onClick={() => handleCopy(api.authConfig?.tokenValue || '', setCopiedAuth)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-850 cursor-pointer shrink-0"
                          title="Copy Token"
                        >
                          {copiedAuth ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* OAuth 2.0 */}
                  {api.authType === 'OAuth 2.0' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 block">Client ID</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-full inline-block">{api.authConfig.clientId}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 block">Client Secret</span>
                          <span className="font-bold text-slate-500 dark:text-slate-600">••••••••••••</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block">Token Exchange URL</span>
                        <span className="font-mono text-[9px] text-slate-655 dark:text-slate-300 break-all">{api.authConfig.tokenUrl}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tags list */}
          {api.tags.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block flex items-center gap-1">
                <Tag size={11} /> Tags
              </span>
              <div className="flex flex-wrap gap-1">
                {api.tags.map(tag => (
                  <span 
                    key={tag}
                    className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Actions Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/20">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleToggleStatus}
            className="flex items-center gap-1.5 cursor-pointer text-xs h-8"
          >
            {api.status === 'Active' ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
            <span>{api.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
          </Button>

          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="flex items-center gap-1.5 cursor-pointer text-xs h-8"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="cursor-pointer text-xs h-8"
            >
              Close
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
