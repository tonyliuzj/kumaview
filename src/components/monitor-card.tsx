"use client"

import { useState } from "react"
import { MonitorWithStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PingHistoryChart } from "@/components/ping-history-chart"
import { formatPing, formatUptime, formatLocalTime } from "@/lib/utils"
import { Activity, Globe, Clock, Zap, CheckCircle2, XCircle, AlertCircle, ExternalLink, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface MonitorCardProps {
  monitor: MonitorWithStatus
  sourceName: string
}

export function MonitorCard({ monitor, sourceName }: MonitorCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getStatusColor = (status: number) => {
    if (status === 1) return "bg-emerald-500"
    if (status === 0) return "bg-rose-500"
    if (status === 2) return "bg-amber-500"
    return "bg-slate-500"
  }

  const getStatusIcon = (status: number) => {
    if (status === 1) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    if (status === 0) return <XCircle className="h-4 w-4 text-rose-500" />
    if (status === 2) return <AlertCircle className="h-4 w-4 text-amber-500" />
    return <Activity className="h-4 w-4 text-slate-500" />
  }

  const getStatusText = (status: number) => {
    if (status === 1) return "Operational"
    if (status === 0) return "Down"
    if (status === 2) return "Pending"
    return "Unknown"
  }

  // Generate status bars
  const renderStatusBars = () => {
    if (!monitor.recent_heartbeats || monitor.recent_heartbeats.length === 0) {
      return (
        <div className="h-8 flex items-end gap-[2px] opacity-50">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="flex-1 bg-slate-200 dark:bg-slate-800 h-2 rounded-sm" />
          ))}
        </div>
      )
    }

    // Fill with empty slots if we have fewer than 24 heartbeats to keep alignment
    const filledHeartbeats = [...monitor.recent_heartbeats]
    while (filledHeartbeats.length < 24) {
      filledHeartbeats.unshift({ status: -1, time: "", msg: "", important: false } as any)
    }
    
    // Take last 24
    const displayHeartbeats = filledHeartbeats.slice(-24)

    return (
      <div className="h-8 flex items-end gap-[2px]">
        {displayHeartbeats.map((hb, i) => {
          if (hb.status === -1) {
             return <div key={`empty-${i}`} className="flex-1 bg-muted h-2 rounded-sm" />
          }
          
          const isUp = hb.status === 1
          const isDown = hb.status === 0
          const isPending = hb.status === 2
          
          let colorClass = "bg-slate-200 dark:bg-slate-800"
          if (isUp) colorClass = "bg-emerald-500 hover:bg-emerald-600"
          else if (isDown) colorClass = "bg-rose-500 hover:bg-rose-600"
          else if (isPending) colorClass = "bg-amber-500 hover:bg-amber-600"

          // Simple height variance based on ping (if available), but clamped
          // Base height is h-4, max is h-full (h-8)
          // Let's just use uniform height for cleanliness like standard status pages
          // Or we can do a small "sparkline" effect:
          // const heightClass = hb.ping && hb.ping > 100 ? "h-6" : hb.ping && hb.ping > 500 ? "h-8" : "h-4"
          
          // Using uniform height for "status bar" look is often cleaner
          const heightClass = "h-5" 

          return (
            <div 
              key={`${hb.time}-${i}`}
              className={cn(
                "flex-1 rounded-sm transition-all duration-200 cursor-help min-w-[3px]",
                colorClass,
                heightClass
              )}
              title={`${hb.time.includes(' ') ? new Date(hb.time.replace(' ', 'T')).toLocaleString() : new Date(hb.time).toLocaleString()} - ${hb.ping ? hb.ping + 'ms' : 'No ping'} - ${hb.msg || getStatusText(hb.status)}`}
            />
          )
        })}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer group relative">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate flex items-center gap-2">
                  {getStatusIcon(monitor.status)}
                  {monitor.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5 mt-1.5 truncate">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate" title={monitor.url}>
                    {monitor.url || "No URL provided"}
                  </span>
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "shrink-0 h-6 px-2 text-[10px] font-medium uppercase tracking-wider",
                  monitor.status === 1 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" :
                  monitor.status === 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800" :
                  monitor.status === 2 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
                  "bg-slate-100 text-slate-600"
                )}
              >
                {getStatusText(monitor.status)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Status Bar Visualization */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">24-Hour Status</p>
              {renderStatusBars()}
            </div>

            <Separator />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 24h Uptime
                </p>
                <p className="text-sm font-bold tabular-nums">
                  {formatUptime(monitor.uptime_24h)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 30d Uptime
                </p>
                <p className="text-sm font-bold tabular-nums">
                  {formatUptime(monitor.uptime_30d)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Avg Ping
                </p>
                <p className="text-sm font-bold tabular-nums">
                  {formatPing(monitor.avg_ping)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Last Check
                </p>
                <p className="text-sm font-bold tabular-nums truncate">
                  {formatLocalTime(monitor.last_heartbeat)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1">
                Source: <span className="font-medium">{sourceName}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
             <DialogTitle className="text-xl">{monitor.name}</DialogTitle>
             <Badge 
                variant="secondary" 
                className={cn(
                  "h-5 px-1.5 text-[10px] font-medium uppercase tracking-wider",
                  monitor.status === 1 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : 
                  monitor.status === 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : 
                  "bg-slate-100 text-slate-600"
                )}
              >
                {getStatusText(monitor.status)}
              </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
             <Globe className="h-4 w-4" />
             <a href={monitor.url} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
               {monitor.url || "No URL"}
               <ExternalLink className="h-3 w-3" />
             </a>
             <span className="mx-2">•</span>
             <span>Source: {sourceName}</span>
          </div>
        </DialogHeader>

        <div className="py-6">
           <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
             <Activity className="h-4 w-4" />
             Response Time History (24h)
           </h4>
           {/* Increased height for the modal view */}
           <PingHistoryChart
             monitorId={monitor.id}
             sourceId={monitor.source_id}
             height={300}
           />
        </div>
      </DialogContent>
    </Dialog>
  )
}
