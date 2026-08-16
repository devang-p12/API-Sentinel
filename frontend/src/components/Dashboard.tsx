import React, { useState } from 'react';
import { useApi } from '../context/ApiContext';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  Plus,
  Search,
  RotateCw,
  MoreVertical,
  Eye,
  Trash2,
  ExternalLink,
  Activity,
  Layers,
  Database,
  GitBranch,
  Filter,
  ArrowUpDown,
  SearchX
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    apis,
    setCurrentRoute,
    deleteApi,
    setSelectedApiId,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    envFilter,
    setEnvFilter,
    sortBy,
    setSortBy,
    isRefreshing,
    refreshApis,
    updateApi
  } = useApi();

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Compute metrics
  const totalApis = apis.length;
  const prodApis = apis.filter(api => api.environment === 'Production').length;
  const stagingApis = apis.filter(api => api.environment === 'Staging').length;
  const devApis = apis.filter(api => api.environment === 'Development').length;

  // Filter & Sort Data
  const filteredApis = apis
    .filter(api => {
      const matchesSearch =
        api.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.baseUrl.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || api.status === statusFilter;
      const matchesEnv = envFilter === 'all' || api.environment === envFilter;

      return matchesSearch && matchesStatus && matchesEnv;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'version') {
        return b.version.localeCompare(a.version);
      } else {
        // createdAt
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const handleRowClick = (apiId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.action-menu-trigger') || target.closest('.action-menu-dropdown')) {
      return;
    }
    setSelectedApiId(apiId);
  };

  return (
    <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6 bg-slate-50/20 dark:bg-slate-950/20 text-slate-800 dark:text-slate-100">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-left">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight m-0 text-slate-900 dark:text-slate-50">
            Registered APIs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Central directory and monitor hub for developer endpoints.
          </p>
        </div>
        <Button
          onClick={() => setCurrentRoute('register')}
          className="flex items-center gap-1.5 cursor-pointer shadow-xs text-xs font-semibold"
        >
          <Plus size={14} />
          <span>Register API</span>
        </Button>
      </div>

      {/* Summary Metrics Section (shadcn style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total APIs */}
        <div className="p-4 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex items-center justify-between card-shadow text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Total APIs
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 block">
              {totalApis}
            </span>
          </div>
          <Database size={15} className="text-slate-400 dark:text-slate-500" />
        </div>

        {/* Production APIs */}
        <div className="p-4 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex items-center justify-between card-shadow text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Production
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 block">
              {prodApis}
            </span>
          </div>
          <Layers size={15} className="text-slate-400 dark:text-slate-500" />
        </div>

        {/* Staging APIs */}
        <div className="p-4 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex items-center justify-between card-shadow text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Staging
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 block">
              {stagingApis}
            </span>
          </div>
          <GitBranch size={15} className="text-slate-400 dark:text-slate-500" />
        </div>

        {/* Development APIs */}
        <div className="p-4 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex items-center justify-between card-shadow text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Development
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 block">
              {devApis}
            </span>
          </div>
          <Activity size={15} className="text-slate-400 dark:text-slate-500" />
        </div>
      </div>

      {/* Table Controls (Filters, Sorting, Search, Refresh) */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 card-shadow">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-550 pointer-events-none">
            <Search size={13} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API name or base URL..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-transparent border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-550 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-300 focus:border-slate-400 dark:focus:border-slate-700 transition-all"
          />
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-slate-400" />
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-md border bg-transparent border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-350 cursor-pointer"
            >
              <option value="all">All Environments</option>
              <option value="Production">Production</option>
              <option value="Staging">Staging</option>
              <option value="Development">Development</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-md border bg-transparent border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-350 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* Sorting */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 text-xs rounded-md border bg-transparent border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-350 cursor-pointer"
            >
              <option value="createdAt">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="version">Sort by Version</option>
            </select>
          </div>

          {/* Refresh Action */}
          <button
            onClick={refreshApis}
            disabled={isRefreshing}
            className="h-8 w-8 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-150 border border-slate-200 dark:border-slate-800 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center"
            title="Refresh Health States"
          >
            <RotateCw size={13} className={`${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* API Table Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden card-shadow">
        {filteredApis.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
            <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 flex items-center justify-center border border-slate-150 dark:border-slate-700">
              <SearchX size={18} />
            </div>
            <div className="space-y-1 max-w-xs text-center">
              <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">No matching APIs</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                No active registered endpoints matching these filter settings.
              </p>
            </div>
            {(searchQuery || statusFilter !== 'all' || envFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-[10px] h-7 cursor-pointer"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setEnvFilter('all');
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-slate-450 dark:text-slate-450 text-[10px] font-bold uppercase tracking-widest">
                  <th className="px-5 py-3">API Name</th>
                  <th className="px-5 py-3">Base URL</th>
                  <th className="px-5 py-3">Environment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Version</th>
                  <th className="px-5 py-3 hidden md:table-cell">Registered</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850/50">
                {filteredApis.map((api) => (
                  <tr
                    key={api.id}
                    onClick={(e) => handleRowClick(api.id, e)}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 cursor-pointer transition-cozy text-xs group"
                  >
                    {/* API Name */}
                    <td className="px-5 py-3">
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:underline transition-all">
                          {api.name}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 max-w-xs mt-0.5 font-normal">
                          {api.description || 'No description provided.'}
                        </span>
                      </div>
                    </td>

                    {/* Base URL */}
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[200px]">{api.baseUrl}</span>
                        <a
                          href={api.baseUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all p-0.5"
                          title="Visit Host"
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </td>

                    {/* Environment */}
                    <td className="px-5 py-3">
                      <Badge variant={api.environment.toLowerCase() as any}>
                        {api.environment}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${api.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-350">
                          {api.status}
                        </span>
                      </div>
                    </td>

                    {/* Version */}
                    <td className="px-5 py-3">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-800">
                        {api.version}
                      </span>
                    </td>

                    {/* Registered Date */}
                    <td className="px-5 py-3 text-[10px] text-slate-450 dark:text-slate-500 hidden md:table-cell font-medium">
                      {formatDate(api.createdAt)}
                    </td>

                    {/* Action trigger dropdown */}
                    <td className="px-5 py-3 text-right relative">
                      <div className="inline-block text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(prev => (prev === api.id ? null : api.id));
                          }}
                          className="action-menu-trigger h-7 w-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-850"
                        >
                          <MoreVertical size={13} />
                        </button>

                        {activeMenuId === api.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                              }}
                            />
                            <div className="action-menu-dropdown absolute right-0 mt-1 w-40 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md py-1 z-20 text-left">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApiId(api.id);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0"
                              >
                                <Eye size={12} className="text-slate-400" />
                                <span>View Details</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateApi(api.id, {
                                    status: api.status === 'Active' ? 'Inactive' : 'Active'
                                  });
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0"
                              >
                                <RotateCw size={12} className="text-slate-400" />
                                <span>Toggle Status</span>
                              </button>
                              <div className="h-px bg-slate-100 dark:bg-slate-850 my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete ${api.name}?`)) {
                                    deleteApi(api.id);
                                  }
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 cursor-pointer border-0"
                              >
                                <Trash2 size={12} />
                                <span>Delete API</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
