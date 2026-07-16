import { z } from 'zod';

export const TrackingLocationSchema = z.object({
  incidentId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
});

export const TrackingBatchSchema = z.object({
  incidentId: z.string().uuid(),
  locations: z.array(
    z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0),
      speed: z.number().nullable().optional(),
      heading: z.number().nullable().optional(),
      timestamp: z.string().datetime(), // Validates ISO-8601 formatted datetime strings
    })
  ).max(100), // Enforces maximum of 100 entries per batch payload
});

export type TrackingLocationInput = z.infer<typeof TrackingLocationSchema>;
export type TrackingBatchInput = z.infer<typeof TrackingBatchSchema>;
