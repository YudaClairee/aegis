export interface LocationUpdate {
  userId: string
  incidentId: string
  latitude: number
  longitude: number
  speed: number | null
  heading: number | null
  accuracy: number
  timestamp: string  // ISO
}

export interface LocationHistoryEntry {
  id: string
  incidentId: string
  latitude: number
  longitude: number
  speed: number | null
  recordedAt: string
}

// Supabase Realtime Broadcast payload
export interface TrackingBroadcastPayload {
  type: 'broadcast'
  event: 'location-update'
  payload: LocationUpdate
}
