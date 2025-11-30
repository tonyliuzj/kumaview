export interface UptimeKumaSource {
  id: number
  name: string
  url: string
  slug: string
  created_at: string
  updated_at: string
}

export interface Monitor {
  id: number
  source_id: number
  name: string
  url?: string
  type?: string
  interval?: number
  created_at: string
  updated_at: string
}

export interface MonitorHeartbeat {
  id: number
  monitor_id: number
  source_id: number
  status: number
  ping?: number
  msg?: string
  important: number
  duration?: number
  timestamp: string
  created_at: string
}

export interface MonitorWithStatus extends Monitor {
  status: number
  uptime_24h?: number
  uptime_30d?: number
  avg_ping?: number
  last_heartbeat?: string
}

export interface UptimeKumaMonitor {
  id: number
  name: string
  url?: string
  type: string
  interval: number
  active: boolean
}

export interface UptimeKumaHeartbeat {
  status: number
  time: string
  msg: string
  ping?: number
  important: boolean
  duration?: number
}
