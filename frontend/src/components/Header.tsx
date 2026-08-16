import React, { useState } from 'react';
import { useApi } from '../context/ApiContext';
import { 
  Search, 
  Bell, 
  Sun, 
  Moon, 
  ChevronRight, 
  Globe, 
  CheckCircle, 
  XCircle 
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    currentRoute, 
    setCurrentRoute, 
    theme, 
    toggleTheme, 
    searchQuery, 
    setSearchQuery, 
    apis 
  } = useApi();

  const [showNotifications, setShowNotifications] = useState(false);

  // Filter out recent logs to simulate notification triggers
  const inactiveApis = apis.filter(api => api.status === 'Inactive');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (currentRoute !== 'dashboard') {
      setCurrentRoute('dashboard');
    }
  };

  return (
    <header className="h-14 border-b bg-white dark:bg-zinc-900 border-slate-150 dark:border-zinc-800/80 px-6 flex items-center justify-between sticky top-0 z-40 transition-colors duration-200">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer transition-colors font-medium">Console</span>
        <ChevronRight size={12} className="text-slate-350 dark:text-slate-600" />
        <span className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer transition-colors font-medium">API Management</span>
        <ChevronRight size={12} className="text-slate-350 dark:text-slate-600" />
        <span className="text-slate-900 dark:text-slate-50 font-semibold">
          {currentRoute === 'dashboard' ? 'Registered APIs' : 'Register API'}
        </span>
      </div>

      {/* Right: Search, Alerts, Theme, Profile */}
      <div className="flex items-center gap-3">
        {/* Search Input bar (shadcn doc-search style) */}
        <div className="relative w-64 hidden md:block group">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none group-focus-within:text-slate-600 dark:group-focus-within:text-slate-300 transition-colors">
            <Search size={13} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search API name or URL..."
            className="w-full pl-8 pr-12 py-1 text-xs rounded-md border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-300 focus:border-slate-400 dark:focus:border-slate-700 transition-all"
          />
          <div className="absolute inset-y-1 right-2 flex items-center pointer-events-none">
            <kbd className="h-5 px-1.5 font-mono text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded select-none shadow-3xs">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="h-8 w-8 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors flex items-center justify-center cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-850"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Notifications Panel */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(prev => !prev)}
            className="h-8 w-8 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors flex items-center justify-center cursor-pointer relative border border-transparent hover:border-slate-200 dark:hover:border-slate-850"
          >
            <Bell size={15} />
            {inactiveApis.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border border-white dark:border-slate-950" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-1.5 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-md shadow-lg py-1.5 z-55 fade-in">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center">
                <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Notifications
                </span>
                <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/25">
                  {inactiveApis.length} Alerts
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {inactiveApis.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1.5">
                    <CheckCircle className="text-emerald-500 mb-0.5" size={16} />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">All Nodes Active</span>
                    <span className="text-[10px] text-slate-400">All registered endpoints are responding successfully.</span>
                  </div>
                ) : (
                  inactiveApis.map(api => (
                    <div key={api.id} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-850/30 flex gap-2.5 items-start border-b border-slate-100 dark:border-slate-850/50 last:border-0">
                      <XCircle className="text-red-500 shrink-0 mt-0.5" size={13} />
                      <div className="flex flex-col text-left gap-0.5 overflow-hidden">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {api.name} Offline
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[210px]">
                          Health check query failed for {api.baseUrl}{api.healthEndpoint}
                        </span>
                        <span className="text-[9px] text-slate-500 mt-0.5">
                          Just now
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

        {/* Server Status Indicator */}
        <div className="items-center gap-1.5 hidden lg:flex">
          <Globe size={13} className="text-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
            Node status: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">ONLINE</span>
          </span>
        </div>
      </div>
    </header>
  );
};
