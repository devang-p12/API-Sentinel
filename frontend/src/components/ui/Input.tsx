import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  wrapperClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  wrapperClassName = '',
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className={`flex flex-col gap-1.5 w-full text-left ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-1.5 text-xs rounded-md border bg-transparent text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-300 focus:border-slate-400 dark:focus:border-slate-700 transition-all disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950/20 ${
          error ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-[10px] text-red-500 font-bold">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
};
