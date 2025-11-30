"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, RefreshCw, Settings, Clock } from "lucide-react"
import type { UptimeKumaSource } from "@/lib/types"
import Link from "next/link"

export default function SettingsPage() {
  const [sources, setSources] = useState<UptimeKumaSource[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<UptimeKumaSource | null>(null)
  const [formData, setFormData] = useState({ name: "", url: "", slug: "" })
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [autoSyncInterval, setAutoSyncInterval] = useState("300")
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    fetchSources()
    fetchSettings()
  }, [])

  const fetchSources = async () => {
    try {
      const response = await fetch("/api/sources")
      const data = await response.json()
      setSources(data)
    } catch (error) {
      console.error("Error fetching sources:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      const data = await response.json()
      setAutoSyncEnabled(data.autoSyncEnabled === "true")
      setAutoSyncInterval(data.autoSyncInterval || "300")
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const saveAutoSyncSettings = async () => {
    setSavingSettings(true)
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "autoSyncEnabled", value: autoSyncEnabled.toString() }),
      })
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "autoSyncInterval", value: autoSyncInterval }),
      })

      // Trigger scheduler update
      await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: autoSyncEnabled ? "start" : "stop",
          interval: parseInt(autoSyncInterval),
        }),
      })

      alert("Auto-sync settings saved successfully")
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Failed to save settings")
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingSource ? `/api/sources/${editingSource.id}` : "/api/sources"
      const method = editingSource ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchSources()
        setDialogOpen(false)
        setEditingSource(null)
        setFormData({ name: "", url: "", slug: "" })
      } else {
        const error = await response.json()
        alert(error.error || "Failed to save source")
      }
    } catch (error) {
      console.error("Error saving source:", error)
      alert("Failed to save source")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this source?")) return

    try {
      const response = await fetch(`/api/sources/${id}`, { method: "DELETE" })
      if (response.ok) {
        await fetchSources()
      }
    } catch (error) {
      console.error("Error deleting source:", error)
    }
  }

  const handleSync = async (sourceId: number) => {
    setSyncing(sourceId)
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Sync completed: ${result.results[0].monitorsUpdated} monitors updated`)
      } else {
        alert("Sync failed")
      }
    } catch (error) {
      console.error("Error syncing:", error)
      alert("Sync failed")
    } finally {
      setSyncing(null)
    }
  }

  const openEditDialog = (source: UptimeKumaSource) => {
    setEditingSource(source)
    setFormData({ name: source.name, url: source.url, slug: source.slug })
    setDialogOpen(true)
  }

  const openAddDialog = () => {
    setEditingSource(null)
    setFormData({ name: "", url: "", slug: "" })
    setDialogOpen(true)
  }

  if (loading) {
    return <div className="min-h-screen p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">Manage your Uptime Kuma sources</p>
          </div>
          <Link href="/">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Auto-Sync Settings
            </CardTitle>
            <CardDescription>
              Automatically sync monitor data at regular intervals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Enable Auto-Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically fetch monitor data from all sources
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSyncEnabled}
                  onCheckedChange={setAutoSyncEnabled}
                />
              </div>

              {autoSyncEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="interval">Sync Interval (seconds)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="30"
                    max="3600"
                    value={autoSyncInterval}
                    onChange={(e) => setAutoSyncInterval(e.target.value)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to sync data (30-3600 seconds)
                  </p>
                </div>
              )}

              <Button onClick={saveAutoSyncSettings} disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Source
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingSource ? "Edit Source" : "Add New Source"}</DialogTitle>
                  <DialogDescription>
                    Add an Uptime Kuma instance to monitor
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Production Server - Main Status"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      A friendly name to identify this status page
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="url">Uptime Kuma URL</Label>
                    <Input
                      id="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://uptime.example.com"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The base URL of your Uptime Kuma instance
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="slug">Status Page Slug</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="my-status-page"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The slug from your status page URL (e.g., for https://uptime.example.com/status/my-status-page, use my-status-page)
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingSource ? "Update" : "Add"} Source</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {sources.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No sources configured. Add your first Uptime Kuma instance to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            sources.map((source) => (
              <Card key={source.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{source.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {source.url}/status/{source.slug}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSync(source.id)}
                        disabled={syncing === source.id}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncing === source.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEditDialog(source)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(source.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p>Added: {new Date(source.created_at).toLocaleString()}</p>
                    <p>Last updated: {new Date(source.updated_at).toLocaleString()}</p>
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
