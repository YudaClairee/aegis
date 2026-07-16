// Guardian Safety Check-in MVP constants
export const SAFETY_CHECKIN = {
  INTERVAL_MS: 5 * 60 * 1000,         // 5 menit
  GRACE_PERIOD_SECONDS: 60,           // 60 detik
  MAX_MISSED_CHECKINS: 1,             // max missed check-in sebelum SOS
} as const;
