// Multi-signal risk scoring weights
export const RISK_WEIGHTS = {
  KEYWORD_DETECTION: 1.0,      // Bobot dari keyword score
  ACCELEROMETER_ANOMALY: 15,   // Gerakan tiba-tiba / HP dijatuhkan
  PHONE_DROP: 25,              // HP jatuh terdeteksi (free-fall)
  SPEED_ANOMALY: 10,           // Kecepatan berubah drastis
  LOCATION_ANOMALY: 10,        // Lokasi berubah drastis (dipaksa pindah)
} as const

// Threshold levels
export const RISK_LEVELS = {
  LOW: 20,
  MEDIUM: 40,
  HIGH: 60,
  CRITICAL: 80,    // Auto-trigger countdown
} as const

// Accelerometer thresholds
export const ACCELEROMETER = {
  SHAKE_THRESHOLD: 2.5,    // g-force untuk "shake" detection
  DROP_THRESHOLD: 0.3,     // g-force saat free-fall (mendekati 0g)
  DROP_DURATION_MS: 300,   // Durasi free-fall minimum (ms)
  SAMPLE_RATE_MS: 100,     // Sampling rate accelerometer
} as const
