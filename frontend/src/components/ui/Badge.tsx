import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'production' | 'staging' | 'development' | 'active' | 'inactive' | 'default';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  const baseStyle = 'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider select-none';
  
  const variants = {
    production: 'bg-violet-50 text-violet-750 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/50',
    staging: 'bg-sky-50 text-sky-750 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50',
    development: 'bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800/30 dark:text-zinc-450 dark:border-zinc-800/50',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900/40',
    inactive: 'bg-red-50 text-red-750 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40',
    default: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700'
  };

  return (
    <span className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
