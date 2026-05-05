import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  try {
    const trimmed = jsonString.trim();
    if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '') return defaultValue;
    return JSON.parse(trimmed);
  } catch (e) {
    console.warn('Failed to parse JSON:', jsonString, e);
    return defaultValue;
  }
}
