export type IncidentStatus = 'triggered' | 'active' | 'resolved' | 'false_alarm'
export type IncidentClassification = 'harassment' | 'robbery' | 'assault' | 'stalking' | 'unknown'
export type TriggerType = 'manual' | 'keyword' | 'risk_engine' | 'notification_button' | 'no_response'

export interface SOSTriggerContext {
  guardianStartedAt?: string
  lastCheckInAt?: string
  missedCheckInAt?: string
  escalationReason?: string
  [key: string]: any
}

export interface IncidentLocation {
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number | null
  heading?: number | null
  address?: string | null  // Reverse geocoded
}

export interface AISummary {
  risk: number                          // 0-100
  classification: IncidentClassification
  recommendation: 'send_sos' | 'monitor' | 'false_alarm'
  summary: string                       // Kronologi otomatis dari AI
  keywords_detected: string[]
  confidence: number                    // 0-1
}

export interface Incident {
  id: string
  userId: string
  status: IncidentStatus
  triggerType: TriggerType
  location: IncidentLocation
  audioUrl: string | null
  transcript: string | null
  aiSummary: AISummary | null
  riskScore: number | null
  classification: IncidentClassification | null
  triggerContext?: SOSTriggerContext | null
  resolvedAt: string | null
  createdAt: string
}

export interface IncidentListItem {
  id: string
  status: IncidentStatus
  triggerType: TriggerType
  classification: IncidentClassification | null
  riskScore: number | null
  location: IncidentLocation
  createdAt: string
}
