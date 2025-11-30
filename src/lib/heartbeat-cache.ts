import { heartbeatCache } from "./cache"

export async function getCachedHeartbeats(sourceId: number): Promise<any | null> {
  return heartbeatCache.getHeartbeats(sourceId)
}

export async function setCachedHeartbeats(sourceId: number, data: any): Promise<void> {
  await heartbeatCache.setHeartbeats(sourceId, data)
}

export async function clearCache(): Promise<void> {
  await heartbeatCache.clearHeartbeats()
}

export async function clearCacheForSource(sourceId: number): Promise<void> {
  await heartbeatCache.clearHeartbeats(sourceId)
}
