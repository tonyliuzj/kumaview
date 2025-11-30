"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Settings, RefreshCw, Activity, Clock, TrendingUp } from "lucide-react"
import type { MonitorWithStatus, UptimeKumaSource } from "@/lib/types"
import Link from "next/link"

export default function Home() {
  const [monitors, setMonitors] = useState<MonitorWithStatus[]>([])
  const [sources, setSources] = useState<UptimeKumaSource[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [monitorsRes, sourcesRes] = await Promise.all([
        fetch("/api/monitors"),
        fetch("/api/sources"),
      ])
      const monitorsData = await monitorsRes.json()
      const sourcesData = await sourcesRes.json()
      setMonitors(monitorsData)
      setSources(sourcesData)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        await fetchData()
        alert("All sources synced successfully")
      } else {
        alert("Sync failed")
      }
    } catch (error) {
      console.error("Error syncing:", error)
      alert("Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadge = (status: number) => {
    if (status === 1) {
      return <Badge variant="success">Up</Badge>
    } else if (status === 0) {
      return <Badge variant="destructive">Down</Badge>
    } else if (status === 2) {
      return <Badge variant="warning">Pending</Badge>
    }
    return <Badge variant="outline">Unknown</Badge>
  }

  const formatUptime = (uptime?: number) => {
    if (uptime === undefined || uptime === null) return "N/A"
    return `${uptime.toFixed(2)}%`
  }

  const formatPing = (ping?: number) => {
    if (ping === undefined || ping === null) return "N/A"
    return `${Math.round(ping)}ms`
  }

  const getSourceName = (sourceId: number) => {
    const source = sources.find((s) => s.id === sourceId)
    return source?.name || "Unknown"
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading monitors...</p>
        </div>
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">KumaView</h1>
              <p className="text-muted-foreground">Uptime Kuma Dashboard</p>
            </div>
            <Link href="/settings">
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Activity className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-semibold mb-2">No Sources Configured</h2>
                <p className="text-muted-foreground mb-6">
                  Get started by adding your first Uptime Kuma instance
                </p>
                <Link href="/settings">
                  <Button>
                    <Settings className="mr-2 h-4 w-4" />
                    Go to Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const upMonitors = monitors.filter((m) => m.status === 1).length
  const downMonitors = monitors.filter((m) => m.status === 0).length
  const totalMonitors = monitors.length

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">KumaView</h1>
            <p className="text-muted-foreground">Monitoring {totalMonitors} services across {sources.length} sources</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSyncAll} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync All
            </Button>
            <Link href="/settings">
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Monitors</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMonitors}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Up</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{upMonitors}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Down</CardTitle>
              <Activity className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{downMonitors}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {monitors.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold mb-2">No Monitors Yet</h2>
                  <p className="text-muted-foreground mb-6">
                    Sync your sources to start monitoring
                  </p>
                  <Button onClick={handleSyncAll} disabled={syncing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                    Sync Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            monitors.map((monitor) => (
              <Card key={`${monitor.source_id}-${monitor.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle>{monitor.name}</CardTitle>
                        {getStatusBadge(monitor.status)}
                      </div>
                      <CardDescription>
                        {monitor.url && <span className="block">{monitor.url}</span>}
                        <span className="text-xs">Source: {getSourceName(monitor.source_id)}</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">24h Uptime</p>
                      <p className="font-semibold">{formatUptime(monitor.uptime_24h)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">30d Uptime</p>
                      <p className="font-semibold">{formatUptime(monitor.uptime_30d)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Avg Ping</p>
                      <p className="font-semibold">{formatPing(monitor.avg_ping)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Last Check</p>
                      <p className="font-semibold">
                        {monitor.last_heartbeat
                          ? new Date(monitor.last_heartbeat).toLocaleTimeString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
