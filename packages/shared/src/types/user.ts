export interface Profile {
  id: string           // UUID dari Supabase Auth
  fullName: string
  phone: string | null
  avatarUrl: string | null
  createdAt: string    // ISO timestamp
}

export interface AuthUser {
  id: string
  email: string
  profile: Profile
}
