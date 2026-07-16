export interface EmergencyContact {
  id: string
  userId: string
  name: string
  phone: string
  relationship: string | null  // 'parent' | 'sibling' | 'partner' | 'friend' | 'other'
  isPrimary: boolean
  fcmToken: string | null      // Jika keluarga install app
  createdAt: string
}

