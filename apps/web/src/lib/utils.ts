import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-emerald-500 bg-emerald-500/10',
    inactive: 'text-gray-500 bg-gray-500/10',
    pending: 'text-amber-500 bg-amber-500/10',
    paid: 'text-emerald-500 bg-emerald-500/10',
    draft: 'text-gray-500 bg-gray-500/10',
    confirmed: 'text-blue-500 bg-blue-500/10',
    cancelled: 'text-red-500 bg-red-500/10',
    delivered: 'text-emerald-500 bg-emerald-500/10',
    new: 'text-blue-500 bg-blue-500/10',
    won: 'text-emerald-500 bg-emerald-500/10',
    lost: 'text-red-500 bg-red-500/10',
  };
  return colors[status.toLowerCase()] ?? 'text-gray-500 bg-gray-500/10';
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
