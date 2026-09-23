import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
export const control =
  'h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50';
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'w-full placeholder:text-muted-foreground', className)} {...props} />;
}
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'max-w-full', className)} {...props} />;
}
