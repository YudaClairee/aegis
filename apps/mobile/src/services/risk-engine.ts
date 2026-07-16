import { RISK_LEVELS, ACCELEROMETER } from '@aegis/shared';

export type RiskSignal = {
  score: number;
  label: string;
};

export function calculateAccelerometerRisk(x: number, y: number, z: number): RiskSignal {
  const magnitude = Math.sqrt(x * x + y * y + z * z);

  if (magnitude <= ACCELEROMETER.DROP_THRESHOLD) {
    return { score: 25, label: 'Phone drop detected' };
  }

  if (magnitude >= ACCELEROMETER.SHAKE_THRESHOLD) {
    return { score: 15, label: 'Sudden shake detected' };
  }

  return { score: 0, label: 'No abnormal movement' };
}

export function calculateKeywordRisk(text: string): RiskSignal | null {
  const lower = text.toLowerCase();

  // Keyword pelaku (Threat level: Critical)
  const perpetratorKeywords = ['diam', 'bunuh', 'mati', 'uang', 'serahkan', 'dompet', 'awas', 'tembak', 'tusuk'];
  for (const word of perpetratorKeywords) {
    if (lower.includes(word)) {
      return { score: 50, label: `Keyword ancaman terdeteksi: "${word}"` };
    }
  }

  // Keyword korban (Threat level: High)
  const victimKeywords = ['tolong', 'jangan', 'berhenti', 'sakit', 'lepas', 'help', 'aw'];
  for (const word of victimKeywords) {
    if (lower.includes(word)) {
      return { score: 35, label: `Keyword darurat terdeteksi: "${word}"` };
    }
  }

  return null;
}

export function determineRiskLevel(score: number) {
  if (score >= RISK_LEVELS.CRITICAL) {
    return 'critical' as const;
  }
  if (score >= RISK_LEVELS.HIGH) {
    return 'high' as const;
  }
  if (score >= RISK_LEVELS.MEDIUM) {
    return 'medium' as const;
  }
  return 'low' as const;
}
