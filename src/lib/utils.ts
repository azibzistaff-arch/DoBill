import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncate20(text: string, limit: number = 20): string {
  if (!text) return '';
  return text.length > limit ? text.slice(0, limit) + '...' : text;
}
