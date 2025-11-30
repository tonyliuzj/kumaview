"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, RefreshCw, Settings, Clock, Key, LogOut } from "lucide-react"
import type { UptimeKumaSource } from "@/lib/types"
import Link from "next/link"

export default function SettingsPage() {
  const router = useRouter()
  const [sources, setSources] = useState<UptimeKumaSource[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [syncing, setSyncing] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<UptimeKumaSource | null>(null)
  const [formData, setFormData] = useState({ name: "", url: "", slug: "" })
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [autoSyncInterval, setAutoSyncInterval] = useState("300")
  const [savingSettings, setSavingSettings] = useState(false)
  const [siteTitle, setSiteTitle] = useState("KumaView")
  const [siteDescription, setSiteDescription] = useState("Unified Uptime Kuma Dashboard")
  const [savingSiteSettings, setSavingSiteSettings] = useState(false)
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false)
  const [credentialsForm, setCredentialsForm] = useState({
    currentPassword: "",
    newUsername: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [savingCredentials, setSavingCredentials] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/settings")
      if (response.status === 401) {
        router.push("/login")
        return
      }
      setAuthenticated(true)
      fetchSources()
      fetchSettings()
    } catch (error) {
      console.error("Auth check failed:", error)
      router.push("/login")
    }
  }

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
      const title = data.siteTitle || "KumaView"
      const description = data.siteDescription || "Unified Uptime Kuma Dashboard"
      setSiteTitle(title)
      setSiteDescription(description)

      // Update document title and meta description
      document.title = `Settings - ${title}`
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute('content', `Configure ${title} settings and manage Uptime Kuma sources`)
      } else {
        const meta = document.createElement('meta')
        meta.name = 'description'
        meta.content = `Configure ${title} settings and manage Uptime Kuma sources`
        document.head.appendChild(meta)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const saveSiteSettings = async () => {
    setSavingSiteSettings(true)
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "siteTitle", value: siteTitle }),
      })
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "siteDescription", value: siteDescription }),
      })

      alert("Site settings saved successfully")
    } catch (error) {
      console.error("Error saving site settings:", error)
      alert("Failed to save site settings")
    } finally {
      setSavingSiteSettings(false)
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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (credentialsForm.newPassword && credentialsForm.newPassword !== credentialsForm.confirmPassword) {
      alert("New passwords do not match")
      return
    }

    if (!credentialsForm.newUsername && !credentialsForm.newPassword) {
      alert("Please provide a new username or password")
      return
    }

    setSavingCredentials(true)
    try {
      const response = await fetch("/api/auth/change-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: credentialsForm.currentPassword,
          newUsername: credentialsForm.newUsername || undefined,
          newPassword: credentialsForm.newPassword || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || "Failed to change credentials")
        setSavingCredentials(false)
        return
      }

      alert("Credentials updated successfully. Please log in again.")
      setCredentialsDialogOpen(false)
      setCredentialsForm({
        currentPassword: "",
        newUsername: "",
        newPassword: "",
        confirmPassword: "",
      })
      await handleLogout()
    } catch (error) {
      console.error("Error changing credentials:", error)
      alert("Failed to change credentials")
      setSavingCredentials(false)
    }
  }

  if (loading || !authenticated) {
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
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Site Settings
            </CardTitle>
            <CardDescription>
              Customize your dashboard title and description
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site-title">Site Title</Label>
                <Input
                  id="site-title"
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  placeholder="KumaView"
                />
                <p className="text-xs text-muted-foreground">
                  The title displayed in the header and browser tab
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site-description">Site Description</Label>
                <Input
                  id="site-description"
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder="Unified Uptime Kuma Dashboard"
                />
                <p className="text-xs text-muted-foreground">
                  A brief description shown below the title
                </p>
              </div>

              <Button onClick={saveSiteSettings} disabled={savingSiteSettings}>
                {savingSiteSettings ? "Saving..." : "Save Site Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Admin Credentials
            </CardTitle>
            <CardDescription>
              Change your admin username or password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="mr-2 h-4 w-4" />
                  Change Credentials
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCredentialsSubmit}>
                  <DialogHeader>
                    <DialogTitle>Change Admin Credentials</DialogTitle>
                    <DialogDescription>
                      Update your username or password. You will be logged out after changing credentials.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="current-password">Current Password *</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={credentialsForm.currentPassword}
                        onChange={(e) => setCredentialsForm({ ...credentialsForm, currentPassword: e.target.value })}
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-username">New Username (optional)</Label>
                      <Input
                        id="new-username"
                        type="text"
                        value={credentialsForm.newUsername}
                        onChange={(e) => setCredentialsForm({ ...credentialsForm, newUsername: e.target.value })}
                        placeholder="Leave blank to keep current"
                        autoComplete="username"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-password">New Password (optional)</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={credentialsForm.newPassword}
                        onChange={(e) => setCredentialsForm({ ...credentialsForm, newPassword: e.target.value })}
                        placeholder="Leave blank to keep current"
                        autoComplete="new-password"
                      />
                    </div>
                    {credentialsForm.newPassword && (
                      <div className="grid gap-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={credentialsForm.confirmPassword}
                          onChange={(e) => setCredentialsForm({ ...credentialsForm, confirmPassword: e.target.value })}
                          required={!!credentialsForm.newPassword}
                          autoComplete="new-password"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={savingCredentials}>
                      {savingCredentials ? "Saving..." : "Update Credentials"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

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
                {savingSettings ? "Saving..." : "Save Auto-Sync Settings"}
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
