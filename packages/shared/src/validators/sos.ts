import { z } from 'zod'

export const SOSTriggerSchema = z.object({
  triggerType: z.enum(['manual', 'keyword', 'risk_engine', 'notification_button']),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
    speed: z.number().nullable().optional(),
    heading: z.number().nullable().optional(),
  }),
  riskScore: z.number().min(0).max(100).optional(),
  keywordsDetected: z.array(z.string()).optional(),
})

export const AudioUploadSchema = z.object({
  incidentId: z.string().uuid(),
  // Audio file akan dikirim sebagai multipart/form-data
})

export const ResolveIncidentSchema = z.object({
  resolution: z.enum(['resolved', 'false_alarm']),
  notes: z.string().optional(),
})

export type SOSTriggerInput = z.infer<typeof SOSTriggerSchema>
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentSchema>
