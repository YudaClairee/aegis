import { z } from 'zod'

export const CreateContactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(8).max(20).regex(/^\+?[0-9\s-]+$/),
  relationship: z.enum(['parent', 'sibling', 'partner', 'friend', 'other']).optional(),
  isPrimary: z.boolean().optional().default(false),
})

export const UpdateContactSchema = CreateContactSchema.partial()

export type CreateContactInput = z.infer<typeof CreateContactSchema>
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>
