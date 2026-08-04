import type { StatusTone } from './data';

/** Dot colors for list rows by tone. */
export const STATUS_TONES: Record<StatusTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-slate-400',
  info: 'bg-sky-500',
};

/** Badge classes for status pills by tone. */
export const statusClasses: Record<StatusTone, string> = {
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-400',
  neutral: 'border-slate-500/20 bg-slate-500/10 text-slate-500 dark:text-slate-400',
  info: 'border-sky-500/20 bg-sky-500/10 text-sky-500 dark:text-sky-400',
};
