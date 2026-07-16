import { create } from 'zustand';
import { startGuardianSession, stopGuardianSession, requestGuardianPermissions } from '../services/guardian';
import { triggerSOS as triggerSOSRequest } from '../services/sos';
import { determineRiskLevel } from '../services/risk-engine';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
};

type GuardianStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'countdown' | 'sos_triggered';

interface GuardianState {
  active: boolean;
  status: GuardianStatus;
  startedAt: string | null;
  riskScore: number;
  riskLevel: RiskLevel;
  lastLocation: LocationData | null;
  lastRiskSignal: string | null;
  countdownSeconds: number;
  countdownActive: boolean;
  countdownType: 'manual' | 'risk_engine' | 'keyword' | 'notification_button' | null;
  error: string | null;
  startGuardian: () => Promise<void>;
  stopGuardian: () => Promise<void>;
  beginCountdown: (triggerType: 'manual' | 'risk_engine' | 'keyword' | 'notification_button') => void;
  cancelCountdown: () => void;
  triggerSOS: (triggerType: 'manual' | 'risk_engine' | 'keyword' | 'notification_button') => Promise<void>;
  setLocation: (location: LocationData) => void;
  setRiskScore: (score: number, signal?: string) => void;
}

let countdownTimer: ReturnType<typeof setInterval> | null = null;

export const useGuardianStore = create<GuardianState>((set, get) => ({
  active: false,
  status: 'idle',
  startedAt: null,
  riskScore: 0,
  riskLevel: 'low',
  lastLocation: null,
  lastRiskSignal: null,
  countdownSeconds: 5,
  countdownActive: false,
  countdownType: null,
  error: null,

  startGuardian: async () => {
    set({ status: 'starting', error: null });

    const permissions = await requestGuardianPermissions();
    if (!permissions.foreground || !permissions.background) {
      set({ status: 'idle', error: 'Izin lokasi tidak lengkap. Guardian tidak dapat dimulai.' });
      return;
    }

    try {
      await startGuardianSession();
      set({
        active: true,
        status: 'active',
        startedAt: new Date().toISOString(),
        error: null,
      });
    } catch (error) {
      set({
        active: false,
        status: 'idle',
        error: (error as Error)?.message ?? 'Gagal memulai Guardian mode.',
      });
    }
  },

  stopGuardian: async () => {
    set({ status: 'stopping', error: null });
    try {
      await stopGuardianSession();
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    } catch {
      // ignore stop errors, still reset state
    }
    set({
      active: false,
      status: 'idle',
      startedAt: null,
      riskScore: 0,
      riskLevel: 'low',
      lastRiskSignal: null,
      countdownActive: false,
      countdownSeconds: 5,
      countdownType: null,
    });
  },

  beginCountdown: (triggerType) => {
    const state = get();
    if (state.countdownActive || state.status === 'sos_triggered') {
      return;
    }
    set({
      status: 'countdown',
      countdownActive: true,
      countdownSeconds: 5,
      countdownType: triggerType,
      error: null,
    });

    if (countdownTimer) {
      clearInterval(countdownTimer);
    }

    countdownTimer = setInterval(async () => {
      const current = get();
      if (current.countdownSeconds <= 1) {
        if (countdownTimer) {
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
        await get().triggerSOS(triggerType);
        return;
      }
      set({ countdownSeconds: current.countdownSeconds - 1 });
    }, 1000);
  },

  cancelCountdown: () => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    set({
      countdownActive: false,
      countdownSeconds: 5,
      countdownType: null,
      status: 'active',
      error: null,
    });
  },

  setLocation: (location) => {
    set({ lastLocation: location });
  },

  setRiskScore: (score, signal) => {
    const normalizedScore = Math.min(Math.max(score, 0), 100);
    set({
      riskScore: normalizedScore,
      riskLevel: determineRiskLevel(normalizedScore),
      lastRiskSignal: signal ?? null,
    });

    const current = get();
    if (
      current.active &&
      !current.countdownActive &&
      normalizedScore >= 80 &&
      current.status === 'active'
    ) {
      get().beginCountdown('risk_engine');
    }
  },

  triggerSOS: async (triggerType) => {
    const state = get();
    if (state.status === 'sos_triggered') {
      return;
    }

    set({ status: 'sos_triggered', countdownActive: false, countdownType: null, error: null });
    try {
      await triggerSOSRequest({
        triggerType,
        location: {
          latitude: state.lastLocation?.latitude ?? 0,
          longitude: state.lastLocation?.longitude ?? 0,
          accuracy: state.lastLocation?.accuracy ?? null,
          speed: state.lastLocation?.speed,
          heading: null,
        },
        riskScore: state.riskScore,
        keywordsDetected: [],
      });
    } catch (error) {
      set({
        error: (error as Error)?.message ?? 'Gagal mengirim SOS. Coba lagi.',
      });
    }
  },
}));
