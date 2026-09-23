import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const number = (value: number) => new Intl.NumberFormat('en-IN').format(value);
export const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value));
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
export const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
