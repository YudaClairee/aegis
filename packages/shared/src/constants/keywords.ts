// Keyword scoring untuk on-device detection
export const DISTRESS_KEYWORDS: Record<string, number> = {
  // High urgency (+3)
  'tolong': 3,
  'help': 3,

  // Medium-high (+2)
  'ampun': 2,
  'lepasin': 2,
  'lepaskan': 2,
  'sakitin': 2,
  'jangan sakitin': 2,
  'maling': 2,
  'copet': 2,
  'rampok': 2,

  // Medium (+1)
  'jangan': 1,
  'pergi': 1,
  'berhenti': 1,
  'stop': 1,
  'tidak mau': 1,
  'minggir': 1,
} as const

export const RISK_THRESHOLD = 4         // Minimum score untuk trigger countdown
export const COUNTDOWN_SECONDS = 5      // Detik sebelum SOS otomatis
export const AUDIO_RECORD_SECONDS = 15  // Durasi rekaman setelah SOS
export const LOCATION_INTERVAL_MS = 5000 // GPS update interval (5 detik)
export const LOCATION_DISTANCE_M = 10    // Minimum distance untuk GPS update (10 meter)
