"use client"

import { useState } from "react"
import { MonitorWithStatus } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PingHistoryChart } from "@/components/ping-history-chart"
import { formatPing, formatUptime, formatLocalTime } from "@/lib/utils"
import { ChevronDown, ChevronUp, Activity, Globe, Clock, Zap, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
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
    <Card className={cn(
      "overflow-hidden transition-all duration-200 hover:shadow-lg border-l-4",
      monitor.status === 1 ? "border-l-emerald-500" : 
      monitor.status === 0 ? "border-l-rose-500" : 
      monitor.status === 2 ? "border-l-amber-500" : "border-l-slate-500"
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-base font-semibold truncate leading-none">
                  {monitor.name}
                </h3>
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
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate hover:underline cursor-pointer" title={monitor.url}>
                    {monitor.url || "No URL provided"}
                  </span>
                </div>
                <div className="hidden sm:block w-1 h-1 rounded-full bg-border" />
                <span className="truncate opacity-75">
                  Source: {sourceName}
                </span>
              </div>
            </div>

            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted/50 shrink-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle details</span>
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Status Bar Visualization */}
          <div className="mb-6">
             {renderStatusBars()}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> 24h Uptime
              </span>
              <p className="text-sm font-semibold tabular-nums">
                {formatUptime(monitor.uptime_24h)}
              </p>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> 30d Uptime
              </span>
              <p className="text-sm font-semibold tabular-nums">
                {formatUptime(monitor.uptime_30d)}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> Avg Ping
              </span>
              <p className="text-sm font-semibold tabular-nums">
                {formatPing(monitor.avg_ping)}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> Last Check
              </span>
              <p className="text-sm font-semibold tabular-nums truncate">
                {formatLocalTime(monitor.last_heartbeat)}
              </p>
            </div>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0">
             <div className="pt-4 border-t border-dashed">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Response Time History (24h)
                </h4>
                {/* Only render chart when open to save performance */}
                {isOpen && (
                  <PingHistoryChart
                    monitorId={monitor.id}
                    sourceId={monitor.source_id}
                  />
                )}
             </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
