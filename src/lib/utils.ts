import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatUptime = (uptime?: number) => {
  if (uptime === undefined || uptime === null) return "N/A"
  return `${uptime.toFixed(2)}%`
}

export const formatPing = (ping?: number) => {
  if (ping === undefined || ping === null) return "N/A"
  return `${Math.round(ping)}ms`
}

export const formatLocalTime = (timestamp?: string | number | Date) => {
  if (!timestamp) return "N/A"

  // Handle Unix timestamps (seconds vs milliseconds)
  let date: Date
  if (typeof timestamp === 'number') {
    // If timestamp is less than year 2100 in milliseconds, it's likely in seconds
    // Unix timestamp in seconds: ~1700000000 (2023)
    // Unix timestamp in milliseconds: ~1700000000000 (2023)
    date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp)
  } else if (typeof timestamp === 'string') {
    // Handle string timestamps in "YYYY-MM-DD HH:mm:ss.SSS" format
    // Timestamps are already in local time, parse as-is
    const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.?(\d+)?/)
    if (match) {
      // Convert to ISO format (without Z to treat as local time)
      const isoString = timestamp.replace(' ', 'T')
      date = new Date(isoString)
    } else {
      // Fallback to standard parsing
      date = new Date(timestamp)
    }
  } else {
    date = new Date(timestamp)
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}
