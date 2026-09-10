import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
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
  const navigate = useNavigate();
  const {
    apis,
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
    updateApi,
    activityFeed
  } = useApi();

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
          onClick={() => navigate('/monitoring/apis')}
          className="flex items-center gap-1.5 cursor-pointer shadow-xs text-xs font-semibold"
        >
          <Plus size={14} />
          <span>Register API</span>
        </Button>
      </div>

      {/* Summary Metrics Section (shadcn style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total APIs */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                Total APIs
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 block">
                {totalApis}
              </span>
            </div>
            <Database size={15} className="text-slate-400 dark:text-slate-500" />
          </CardContent>
        </Card>

        {/* Production APIs */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                Production
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 block">
                {prodApis}
              </span>
            </div>
            <Layers size={15} className="text-slate-400 dark:text-slate-500" />
          </CardContent>
        </Card>

        {/* Staging APIs */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                Staging
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 block">
                {stagingApis}
              </span>
            </div>
            <GitBranch size={15} className="text-slate-400 dark:text-slate-500" />
          </CardContent>
        </Card>

        {/* Development APIs */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                Development
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 block">
                {devApis}
              </span>
            </div>
            <Activity size={15} className="text-slate-400 dark:text-slate-500" />
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed Section */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-lg">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity size={14} className="text-blue-500" />
            Live Activity Feed
          </h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Real-time
          </span>
        </div>
        <CardContent className="p-0">
          <div className="h-40 overflow-y-auto px-4 py-2 space-y-2 custom-scrollbar">
            {activityFeed && activityFeed.length > 0 ? (
              activityFeed.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-2 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    event.type === 'API_STATUS_CHANGED' ? 'bg-amber-500' :
                    event.type === 'ALERT_TRIGGERED' ? 'bg-rose-500' :
                    event.type === 'INCIDENT_RESOLVED' ? 'bg-emerald-500' :
                    event.type === 'SCHEMA_CHANGED' ? 'bg-purple-500' :
                    'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                      {event.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(event.timestamp).toLocaleTimeString()} {event.environment ? `• ${event.environment}` : ''}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                No recent activity. Waiting for events...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table Controls (Filters, Sorting, Search, Refresh) */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 card-shadow">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-550 pointer-events-none z-10">
            <Search size={13} />
          </span>
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API name or base URL..."
            className="pl-8 w-full bg-transparent border-slate-200 dark:border-slate-800 h-8"
          />
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-slate-400" />
            <Select value={envFilter} onValueChange={(val) => val && setEnvFilter(val)}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-transparent border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="All Environments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="Production">Production</SelectItem>
                <SelectItem value="Staging">Staging</SelectItem>
                <SelectItem value="Development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-transparent border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Sorting */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-slate-400" />
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-transparent border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Sort by Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Sort by Date</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="version">Sort by Version</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="icon"
            onClick={refreshApis}
            disabled={isRefreshing}
            className="h-8 w-8"
            title="Refresh Health States"
          >
            <RotateCw size={13} className={`${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
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
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-950/20 text-slate-450 dark:text-slate-450 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                  <TableHead className="px-5 py-3 h-auto">API Name</TableHead>
                  <TableHead className="px-5 py-3 h-auto">Base URL</TableHead>
                  <TableHead className="px-5 py-3 h-auto">Environment</TableHead>
                  <TableHead className="px-5 py-3 h-auto">Status</TableHead>
                  <TableHead className="px-5 py-3 h-auto">Version</TableHead>
                  <TableHead className="px-5 py-3 h-auto hidden md:table-cell">Registered</TableHead>
                  <TableHead className="px-5 py-3 h-auto text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-slate-850/50">
                {filteredApis.map((api) => (
                  <TableRow
                    key={api.id}
                    onClick={(e) => handleRowClick(api.id, e)}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 cursor-pointer transition-cozy text-xs group border-b-0"
                  >
                    {/* API Name */}
                    <TableCell className="px-5 py-3">
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:underline transition-all">
                          {api.name}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 max-w-xs mt-0.5 font-normal">
                          {api.description || 'No description provided.'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Base URL */}
                    <TableCell className="px-5 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
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
                    </TableCell>

                    {/* Environment */}
                    <TableCell className="px-5 py-3">
                      <Badge variant={api.environment.toLowerCase() as any}>
                        {api.environment}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${api.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-350">
                          {api.status}
                        </span>
                      </div>
                    </TableCell>

                    {/* Version */}
                    <TableCell className="px-5 py-3">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-800">
                        {api.version}
                      </span>
                    </TableCell>

                    {/* Registered Date */}
                    <TableCell className="px-5 py-3 text-[10px] text-slate-450 dark:text-slate-500 hidden md:table-cell font-medium">
                      {formatDate(api.createdAt)}
                    </TableCell>

                    {/* Action trigger dropdown */}
                    <TableCell className="px-5 py-3 text-right relative">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-850 text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          <MoreVertical size={13} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 text-xs text-left" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => setSelectedApiId(api.id)} className="cursor-pointer font-semibold">
                            <Eye size={12} className="mr-2 text-slate-400" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateApi(api.id, { status: api.status === 'Active' ? 'Inactive' : 'Active' })} className="cursor-pointer font-semibold">
                            <RotateCw size={12} className="mr-2 text-slate-400" /> Toggle Status
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { if (confirm(`Are you sure you want to delete ${api.name}?`)) deleteApi(api.id); }} className="cursor-pointer font-semibold text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20">
                            <Trash2 size={12} className="mr-2" /> Delete API
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
