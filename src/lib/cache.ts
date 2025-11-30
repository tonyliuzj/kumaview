import { getDb } from "./db"

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  key: string
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  prefix?: string
}

export interface CacheStats {
  totalEntries: number
  memoryUsage: number
  hitRate: number
  missRate: number
}

class PersistentCache {
  private memoryCache = new Map<string, CacheEntry>()
  private hitCount = 0
  private missCount = 0
  private readonly defaultTTL = 5 * 60 * 1000 // 5 minutes default

  constructor() {
    this.initializeDatabase()
    this.startCleanupInterval()
  }

  private initializeDatabase() {
    const db = getDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        ttl INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_cache_timestamp ON cache_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_cache_ttl ON cache_entries(ttl);
    `)
  }

  private startCleanupInterval() {
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanupExpiredEntries()
    }, 60 * 1000)
  }

  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.defaultTTL
    const prefixedKey = this.prefixKey(key, options.prefix)
    const timestamp = Date.now()
    const entry: CacheEntry<T> = {
      data,
      timestamp,
      ttl,
      key: prefixedKey
    }

    // Store in memory cache
    this.memoryCache.set(prefixedKey, entry)

    // Store in persistent storage
    try {
      const db = getDb()
      db.prepare(`
        INSERT OR REPLACE INTO cache_entries (key, data, timestamp, ttl)
        VALUES (?, ?, ?, ?)
      `).run(prefixedKey, JSON.stringify(data), timestamp, ttl)
    } catch (error) {
      console.error(`Failed to persist cache entry for key ${prefixedKey}:`, error)
    }
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const prefixedKey = this.prefixKey(key, options.prefix)

    // Try memory cache first
    const memoryEntry = this.memoryCache.get(prefixedKey)
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.hitCount++
      return memoryEntry.data
    }

    // Try persistent storage
    try {
      const db = getDb()
      const row = db.prepare(`
        SELECT data, timestamp, ttl 
        FROM cache_entries 
        WHERE key = ?
      `).get(prefixedKey) as { data: string; timestamp: number; ttl: number } | undefined

      if (row) {
        const entry: CacheEntry<T> = {
          data: JSON.parse(row.data),
          timestamp: row.timestamp,
          ttl: row.ttl,
          key: prefixedKey
        }

        if (!this.isExpired(entry)) {
          // Update memory cache
          this.memoryCache.set(prefixedKey, entry)
          this.hitCount++
          return entry.data
        } else {
          // Remove expired entry
          this.delete(key, options)
        }
      }
    } catch (error) {
      console.error(`Failed to read cache entry for key ${prefixedKey}:`, error)
    }

    this.missCount++
    return null
  }

  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const prefixedKey = this.prefixKey(key, options.prefix)

    // Remove from memory cache
    this.memoryCache.delete(prefixedKey)

    // Remove from persistent storage
    try {
      const db = getDb()
      const result = db.prepare("DELETE FROM cache_entries WHERE key = ?").run(prefixedKey)
      return result.changes > 0
    } catch (error) {
      console.error(`Failed to delete cache entry for key ${prefixedKey}:`, error)
      return false
    }
  }

  async clear(prefix?: string): Promise<void> {
    try {
      const db = getDb()

      if (prefix) {
        const prefixedKey = this.prefixKey('', prefix)
        const pattern = `${prefixedKey}%`
        
        // Clear memory cache
        for (const [key] of this.memoryCache) {
          if (key.startsWith(prefixedKey)) {
            this.memoryCache.delete(key)
          }
        }

        // Clear persistent storage
        db.prepare("DELETE FROM cache_entries WHERE key LIKE ?").run(pattern)
      } else {
        // Clear everything
        this.memoryCache.clear()
        db.prepare("DELETE FROM cache_entries").run()
      }
    } catch (error) {
      console.error("Failed to clear cache:", error)
    }
  }

  async getKeys(prefix?: string): Promise<string[]> {
    try {
      const db = getDb()
      let query = "SELECT key FROM cache_entries"
      const params: any[] = []

      if (prefix) {
        const prefixedKey = this.prefixKey('', prefix)
        query += " WHERE key LIKE ?"
        params.push(`${prefixedKey}%`)
      }

      const rows = db.prepare(query).all(...params) as { key: string }[]
      return rows.map(row => row.key)
    } catch (error) {
      console.error("Failed to get cache keys:", error)
      return []
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const db = getDb()
      const row = db.prepare("SELECT COUNT(*) as count FROM cache_entries").get() as { count: number }

      const totalRequests = this.hitCount + this.missCount
      const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0
      const missRate = totalRequests > 0 ? this.missCount / totalRequests : 0

      return {
        totalEntries: row.count,
        memoryUsage: this.memoryCache.size,
        hitRate,
        missRate
      }
    } catch (error) {
      console.error("Failed to get cache stats:", error)
      return {
        totalEntries: 0,
        memoryUsage: 0,
        hitRate: 0,
        missRate: 0
      }
    }
  }

  private prefixKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now()

    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key)
      }
    }

    // Clean persistent storage
    try {
      const db = getDb()
      db.prepare("DELETE FROM cache_entries WHERE timestamp + ttl < ?").run(now)
    } catch (error) {
      console.error("Failed to cleanup expired cache entries:", error)
    }
  }
}

// Specialized cache for heartbeat data
export class HeartbeatCache extends PersistentCache {
  private readonly HEARTBEAT_PREFIX = 'heartbeat'
  private readonly HEARTBEAT_TTL = 2 * 60 * 1000 // 2 minutes for heartbeat data

  async setHeartbeats(sourceId: number, data: any): Promise<void> {
    const key = `source_${sourceId}`
    await this.set(key, data, {
      prefix: this.HEARTBEAT_PREFIX,
      ttl: this.HEARTBEAT_TTL
    })
  }

  async getHeartbeats(sourceId: number): Promise<any | null> {
    const key = `source_${sourceId}`
    return this.get(key, {
      prefix: this.HEARTBEAT_PREFIX
    })
  }

  async clearHeartbeats(sourceId?: number): Promise<void> {
    if (sourceId) {
      const key = `source_${sourceId}`
      await this.delete(key, { prefix: this.HEARTBEAT_PREFIX })
    } else {
      await this.clear(this.HEARTBEAT_PREFIX)
    }
  }
}

// Export singleton instances
export const persistentCache = new PersistentCache()
export const heartbeatCache = new HeartbeatCache()
