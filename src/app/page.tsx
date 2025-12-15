"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Settings, RefreshCw, Activity, Clock, TrendingUp, Zap, CheckCircle2, XCircle, AlertCircle, LayoutGrid, List } from "lucide-react"
import type { MonitorWithStatus, UptimeKumaSource } from "@/lib/types"
import Link from "next/link"
import { MonitorCard } from "@/components/monitor-card"
import { cn } from "@/lib/utils"

export default function Home() {
  const [monitors, setMonitors] = useState<MonitorWithStatus[]>([])
  const [sources, setSources] = useState<UptimeKumaSource[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [syncIntervalSeconds, setSyncIntervalSeconds] = useState(300)
  const [timeProgress, setTimeProgress] = useState(0)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [siteTitle, setSiteTitle] = useState("KumaView")
  const [siteDescription, setSiteDescription] = useState("Unified Uptime Kuma Dashboard")

  // For live animation
  const [tick, setTick] = useState(0)

  const checkSyncStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sync-status")
      const data = await response.json()

      const wasSyncing = autoSyncing
      const isSyncing = data.syncEngine?.isSyncing || false
      const lastRun = data.scheduler?.lastRun
      const lastSuccessfulSync = data.health?.lastSuccessfulSync
      const intervalSeconds = data.scheduler?.config?.intervalSeconds

      setAutoSyncing(isSyncing)

      // Use lastRun from scheduler, or fall back to lastSuccessfulSync from health check
      const syncTime = lastRun || lastSuccessfulSync
      if (syncTime) {
        setLastSyncTime(syncTime)
      }

      if (intervalSeconds) {
        setSyncIntervalSeconds(intervalSeconds)
      }

      // If sync just finished, refresh data
      if (wasSyncing && !isSyncing) {
        await fetchData()
      }
    } catch (error) {
      console.error("Error checking sync status:", error)
    }
  }, [autoSyncing])

  useEffect(() => {
    // Initialize scheduler on app load
    fetch("/api/init").catch(err => console.error("Failed to initialize scheduler:", err))

    fetchData()
    fetchSettings()
    checkSyncStatus() // Check sync status immediately on mount

    // Poll sync status every 5 seconds (reduced from 2 seconds)
    const statusInterval = setInterval(() => {
        checkSyncStatus()
        setTick(t => t + 1)
    }, 5000)

    // Update progress bar every 500ms (reduced from 100ms)
    const progressInterval = setInterval(() => {
      if (lastSyncTime) {
        const now = new Date().getTime()
        const last = new Date(lastSyncTime).getTime()
        const elapsed = (now - last) / 1000
        const progress = Math.min(100, (elapsed / syncIntervalSeconds) * 100)
        setTimeProgress(progress)
      }
    }, 500)

    return () => {
      clearInterval(statusInterval)
      clearInterval(progressInterval)
    }
  }, [lastSyncTime, syncIntervalSeconds, checkSyncStatus])

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

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      const data = await response.json()
      const title = data.siteTitle || "KumaView"
      const description = data.siteDescription || "Unified Uptime Kuma Dashboard"
      setSiteTitle(title)
      setSiteDescription(description)

      // Update document title and meta description
      document.title = `${title} - ${description}`
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute('content', description)
      } else {
        const meta = document.createElement('meta')
        meta.name = 'description'
        meta.content = description
        document.head.appendChild(meta)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
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
        // Update last sync time immediately
        setLastSyncTime(new Date().toISOString())
        await fetchData()
        await checkSyncStatus() // Refresh sync status after manual sync
        // alert("All sources synced successfully")
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

  const getSourceName = (sourceId: number) => {
    const source = sources.find((s) => s.id === sourceId)
    return source?.name || "Unknown"
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-4">
          <div className="relative">
             <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary" />
             <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary animate-pulse" />
             </div>
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="min-h-screen p-8 bg-muted/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2 tracking-tight">{siteTitle}</h1>
              <p className="text-muted-foreground">{siteDescription}</p>
            </div>
            <Link href="/settings">
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>

          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Activity className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">No Sources Configured</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Get started by adding your first Uptime Kuma instance to visualize your monitors in one place.
                </p>
                <Link href="/settings">
                  <Button size="lg">
                    <Settings className="mr-2 h-4 w-4" />
                    Configure Settings
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
  const pendingMonitors = monitors.filter((m) => m.status === 2).length
  const totalMonitors = monitors.length

  return (
    <div className="min-h-screen bg-muted/10">
      <div className="border-b bg-background sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight">{siteTitle}</h1>
            <div className="h-6 w-[1px] bg-border hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
               <Badge variant="outline" className="h-6 gap-1.5 px-2 bg-background/50">
                 <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live
              </Badge>
              {autoSyncing && (
                <Badge variant="secondary" className="gap-1 animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Syncing
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="text-right hidden md:block mr-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Next Sync</p>
                <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-linear"
                    style={{ width: `${timeProgress}%` }}
                  />
                </div>
             </div>
             
            <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Link href="/settings">
              <Button size="sm" variant="ghost">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-background shadow-sm border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Monitors</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMonitors}</div>
              <p className="text-xs text-muted-foreground mt-1">Active monitoring targets</p>
            </CardContent>
          </Card>
          <Card className="bg-background shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Operational</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{upMonitors}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalMonitors > 0 ? Math.round((upMonitors / totalMonitors) * 100) : 0}% uptime
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background shadow-sm border-l-4 border-l-rose-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Down</CardTitle>
              <XCircle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-500">{downMonitors}</div>
              <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
            </CardContent>
          </Card>
           <Card className="bg-background shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{pendingMonitors}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting status</p>
            </CardContent>
          </Card>
        </div>

        {/* Monitors List */}
        <div className="space-y-4">
          <Tabs defaultValue="all" className="w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="all">All Monitors</TabsTrigger>
                    <TabsTrigger value="up" className="text-emerald-600 data-[state=active]:text-emerald-700">Operational</TabsTrigger>
                    <TabsTrigger value="down" className="text-rose-600 data-[state=active]:text-rose-700">Down</TabsTrigger>
                    {pendingMonitors > 0 && (
                        <TabsTrigger value="pending" className="text-amber-600 data-[state=active]:text-amber-700">Pending</TabsTrigger>
                    )}
                    {sources.map((source) => (
                        <TabsTrigger key={`source-${source.id}`} value={`source-${source.id}`}>
                            {source.name}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <div className="flex items-center bg-background rounded-lg border p-1">
                    <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setViewMode("grid")}
                    >
                        <LayoutGrid className="h-4 w-4" />
                        <span className="sr-only">Grid View</span>
                    </Button>
                    <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setViewMode("list")}
                    >
                        <List className="h-4 w-4" />
                        <span className="sr-only">List View</span>
                    </Button>
                </div>
            </div>

            {monitors.length === 0 ? (
                <Card className="border-dashed">
                <CardContent className="pt-6">
                    <div className="text-center py-12">
                    <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
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
                <>
                    <TabsContent value="all" className="mt-0">
                         <div className={cn(
                             "grid gap-4",
                             viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
                         )}>
                            {monitors.map((monitor) => (
                                <MonitorCard 
                                    key={`${monitor.source_id}-${monitor.id}`}
                                    monitor={monitor}
                                    sourceName={getSourceName(monitor.source_id)}
                                />
                            ))}
                         </div>
                    </TabsContent>
                    <TabsContent value="up" className="mt-0">
                         <div className={cn(
                             "grid gap-4",
                             viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
                         )}>
                            {monitors.filter(m => m.status === 1).map((monitor) => (
                                <MonitorCard 
                                    key={`${monitor.source_id}-${monitor.id}`}
                                    monitor={monitor}
                                    sourceName={getSourceName(monitor.source_id)}
                                />
                            ))}
                         </div>
                    </TabsContent>
                    <TabsContent value="down" className="mt-0">
                         <div className={cn(
                             "grid gap-4",
                             viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
                         )}>
                            {monitors.filter(m => m.status === 0).map((monitor) => (
                                <MonitorCard 
                                    key={`${monitor.source_id}-${monitor.id}`}
                                    monitor={monitor}
                                    sourceName={getSourceName(monitor.source_id)}
                                />
                            ))}
                         </div>
                    </TabsContent>
                    <TabsContent value="pending" className="mt-0">
                         <div className={cn(
                             "grid gap-4",
                             viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
                         )}>
                            {monitors.filter(m => m.status === 2).map((monitor) => (
                                <MonitorCard
                                    key={`${monitor.source_id}-${monitor.id}`}
                                    monitor={monitor}
                                    sourceName={getSourceName(monitor.source_id)}
                                />
                            ))}
                         </div>
                    </TabsContent>
                    {sources.map((source) => (
                        <TabsContent key={`source-content-${source.id}`} value={`source-${source.id}`} className="mt-0">
                            <div className={cn(
                                "grid gap-4",
                                viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
                            )}>
                                {monitors.filter(m => m.source_id === source.id).map((monitor) => (
                                    <MonitorCard
                                        key={`${monitor.source_id}-${monitor.id}`}
                                        monitor={monitor}
                                        sourceName={source.name}
                                    />
                                ))}
                            </div>
                            {monitors.filter(m => m.source_id === source.id).length === 0 && (
                                <Card className="border-dashed">
                                    <CardContent className="pt-6">
                                        <div className="text-center py-12">
                                            <Activity className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                                            <h2 className="text-xl font-semibold mb-2">No Monitors</h2>
                                            <p className="text-muted-foreground">
                                                No monitors found for {source.name}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                    ))}
                </>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  )
}
