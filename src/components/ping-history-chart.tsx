"use client"

import { useEffect, useState, useCallback } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { MonitorHeartbeat } from "@/lib/types"

interface PingHistoryChartProps {
  monitorId: number
  sourceId: number
  height?: number
}

export function PingHistoryChart({ monitorId, sourceId, height = 200 }: PingHistoryChartProps) {
  const [heartbeats, setHeartbeats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHeartbeats = useCallback(async () => {
    try {
      const response = await fetch(`/api/heartbeats?monitor_id=${monitorId}&source_id=${sourceId}`)

      if (response.ok) {
        const data = await response.json()
        setHeartbeats(data)
      }
    } catch (error) {
      console.error("Error fetching heartbeats:", error)
    } finally {
      setLoading(false)
    }
  }, [monitorId, sourceId])

  useEffect(() => {
    fetchHeartbeats()
  }, [fetchHeartbeats])

  if (loading) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-muted-foreground">
        Loading chart...
      </div>
    )
  }

  if (heartbeats.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-muted-foreground">
        No ping data available
      </div>
    )
  }

  // Prepare data for the chart
  // Uptime Kuma returns newest first, so we need to reverse to show oldest to newest (left to right)
  // But first, let's check the actual order from the API
  const chartData = heartbeats
    .slice()
    .map((hb, index) => {
      // Handle Unix timestamps (seconds vs milliseconds)
      let date: Date
      if (typeof hb.time === 'number') {
        date = hb.time < 10000000000 ? new Date(hb.time * 1000) : new Date(hb.time)
      } else if (typeof hb.time === 'string') {
        // Handle string timestamps in "YYYY-MM-DD HH:mm:ss.SSS" format
        // Timestamps are already in local time, parse as-is
        const match = hb.time.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.?(\d+)?/)
        if (match) {
          // Convert to ISO format (without Z to treat as local time)
          const isoString = hb.time.replace(' ', 'T')
          date = new Date(isoString)
        } else {
          date = new Date(hb.time)
        }
      } else {
        date = new Date(hb.time)
      }

      return {
        timestamp: date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        ping: hb.ping || 0,
        status: hb.status,
        fullTimestamp: date.toLocaleString(),
        rawTime: hb.time,
        dateObj: date
      }
    })
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()) // Sort by time ascending (oldest to newest)

  // Calculate statistics
  const pings = heartbeats.filter(hb => hb.ping !== null).map(hb => hb.ping!)
  const avgPing = pings.length > 0 ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : 0
  const minPing = pings.length > 0 ? Math.min(...pings) : 0
  const maxPing = pings.length > 0 ? Math.max(...pings) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Avg Ping</p>
          <p className="font-semibold">{avgPing}ms</p>
        </div>
        <div>
          <p className="text-muted-foreground">Min Ping</p>
          <p className="font-semibold text-green-600">{minPing}ms</p>
        </div>
        <div>
          <p className="text-muted-foreground">Max Ping</p>
          <p className="font-semibold text-red-600">{maxPing}ms</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: 'Ping (ms)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="bg-background border rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-semibold">{data.fullTimestamp}</p>
                    <p className="text-sm">
                      Ping: <span className="font-semibold">{data.ping}ms</span>
                    </p>
                    <p className="text-sm">
                      Status: <span className={`font-semibold ${data.status === 1 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.status === 1 ? 'Up' : 'Down'}
                      </span>
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Line
            type="monotone"
            dataKey="ping"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
