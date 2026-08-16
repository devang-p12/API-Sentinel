import React from 'react';
import { useApi } from '../context/ApiContext';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Sun, 
  Moon, 
  Terminal,
  Activity
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    currentRoute, 
    setCurrentRoute, 
    theme, 
    toggleTheme,
    isRefreshing,
    refreshApis,
    setSearchQuery,
    setStatusFilter,
    setEnvFilter
  } = useApi();

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setEnvFilter('all');
  };

  return (
    <aside className="w-64 h-full shrink-0 flex flex-col justify-between p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm text-left">
      
      {/* Floating Stack Group */}
      <div className="space-y-4">
        
        {/* Menu Header Card */}
        <div className="px-3.5 py-1 flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-widest text-slate-800 dark:text-zinc-100">
            Menu
          </span>
          <div className="flex flex-col gap-1 w-4 items-end cursor-pointer" title="Menu Button">
            <div className="h-0.5 w-4 bg-slate-800 dark:bg-zinc-350 rounded" />
            <div className="h-0.5 w-4 bg-slate-800 dark:bg-zinc-350 rounded" />
          </div>
        </div>

        <div className="h-px bg-slate-100 dark:bg-zinc-800/80 mx-1" />

        {/* Card Options Stack */}
        <div className="space-y-3">
          
          {/* Card Option: Registered APIs */}
          <button 
            onClick={() => setCurrentRoute('dashboard')}
            className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
              currentRoute === 'dashboard'
                ? 'border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 shadow-3xs'
                : 'border-slate-150 dark:border-zinc-800/50 bg-transparent hover:bg-slate-50/50 dark:hover:bg-zinc-900/50'
            }`}
          >
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 dark:text-zinc-550 uppercase tracking-widest font-extrabold">
                Navigation
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                Registered APIs
              </span>
            </div>
            <div className={`h-6 w-6 rounded-md flex items-center justify-center border transition-colors ${
              currentRoute === 'dashboard'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-900 border-slate-900 dark:border-white'
                : 'bg-slate-50 dark:bg-zinc-850 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-800'
            }`}>
              <LayoutDashboard size={12} />
            </div>
          </button>

          {/* Card Option: Register API */}
          <button 
            onClick={() => setCurrentRoute('register')}
            className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
              currentRoute === 'register'
                ? 'border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 shadow-3xs'
                : 'border-slate-150 dark:border-zinc-800/50 bg-transparent hover:bg-slate-50/50 dark:hover:bg-zinc-900/50'
            }`}
          >
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 dark:text-zinc-550 uppercase tracking-widest font-extrabold">
                Action
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                Register New API
              </span>
            </div>
            <div className={`h-6 w-6 rounded-md flex items-center justify-center border transition-colors ${
              currentRoute === 'register'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-900 border-slate-900 dark:border-white'
                : 'bg-slate-50 dark:bg-zinc-850 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-800'
            }`}>
              <PlusCircle size={12} />
            </div>
          </button>

          {/* Card Option: Theme */}
          <button 
            onClick={toggleTheme}
            className="w-full p-3.5 rounded-xl border border-slate-150 dark:border-zinc-800/50 bg-transparent hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 text-left flex items-center justify-between transition-all duration-200 cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 dark:text-zinc-550 uppercase tracking-widest font-extrabold">
                Theme Style
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <div className="h-6 w-6 rounded-md bg-slate-50 dark:bg-zinc-850 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 flex items-center justify-center">
              {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
            </div>
          </button>

          {/* Card Option: System Status */}
          <div className="w-full p-3.5 rounded-xl border border-slate-150 dark:border-zinc-800/50 bg-transparent text-left flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 dark:text-zinc-550 uppercase tracking-widest font-extrabold">
                Sentinel Node
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                Active Node
              </span>
            </div>
            <div className="h-6 w-6 rounded-md bg-emerald-500/10 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
              <Activity size={12} className="animate-pulse" />
            </div>
          </div>

          {/* Card Option: Project Info */}
          <div className="w-full p-3.5 rounded-xl border border-slate-150 dark:border-zinc-800/50 bg-transparent text-left flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 dark:text-zinc-550 uppercase tracking-widest font-extrabold">
                Platform Console
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                API Sentinel
              </span>
            </div>
            <div className="h-6 w-6 rounded-md bg-slate-50 dark:bg-zinc-850 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 flex items-center justify-center">
              <Terminal size={12} />
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Option Group (buttons) */}
      <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-zinc-800/80">
        
        {/* Preset Style Stats Card */}
        <div className="w-full py-2 text-center text-[10px] font-mono font-extrabold text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 rounded-xl bg-transparent select-none">
          --console v1.2
        </div>

        {/* Action Button: Refresh */}
        <button 
          onClick={refreshApis}
          disabled={isRefreshing}
          className="w-full py-2 text-center text-xs font-bold text-slate-800 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-zinc-800 rounded-xl bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-900/50 cursor-pointer transition-all disabled:opacity-50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Nodes'}
        </button>

        {/* Action Button: Reset Filters */}
        <button 
          onClick={handleResetFilters}
          className="w-full py-2 text-center text-xs font-bold text-slate-800 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-zinc-800 rounded-xl bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-900/50 cursor-pointer transition-all"
        >
          Reset Filters
        </button>

        <div className="h-2" />

        {/* Primary Action Button: Get Code style */}
        <button 
          onClick={() => setCurrentRoute('register')}
          className="w-full py-2.5 text-center text-xs font-bold bg-slate-900 text-slate-50 dark:bg-white dark:text-zinc-950 rounded-xl hover:bg-slate-900/90 dark:hover:bg-white/90 transition-all cursor-pointer shadow-sm"
        >
          Register API
        </button>

      </div>
    </aside>
  );
};
