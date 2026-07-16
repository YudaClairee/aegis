import { create } from 'zustand';
import { router } from 'expo-router';
import {
  startGuardianSession,
  stopGuardianSession,
  requestGuardianPermissions,
  startAccelerometerMonitoring,
  stopAccelerometerMonitoring,
} from '../services/guardian';
import { triggerSOS as triggerSOSRequest } from '../services/sos';
import { determineRiskLevel, calculateAccelerometerRisk } from '../services/risk-engine';
import { startRecordingSession } from '../services/audio';
import { SAFETY_CHECKIN } from '@aegis/shared';
import { startLiveBroadcast, broadcastLocation, stopLiveBroadcast, persistLocationHistory } from '../services/live-tracking';
import { supabase } from '../lib/supabase';

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
  countdownType: 'manual' | 'risk_engine' | 'keyword' | 'notification_button' | 'no_response' | null;
  error: string | null;
  nextCheckInAt: string | null;
  checkInCountdownActive: boolean;
  checkInCountdownSeconds: number;
  isAudioPermissionGranted: boolean;
  activeIncidentId: string | null;
  startGuardian: () => Promise<void>;
  stopGuardian: () => Promise<void>;
  beginCountdown: (triggerType: 'manual' | 'risk_engine' | 'keyword' | 'notification_button' | 'no_response') => void;
  cancelCountdown: () => void;
  triggerSOS: (triggerType: 'manual' | 'risk_engine' | 'keyword' | 'notification_button' | 'no_response') => Promise<void>;
  setLocation: (location: LocationData) => void;
  setRiskScore: (score: number, signal?: string) => void;
  confirmSafety: () => void;
}

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

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
  nextCheckInAt: null,
  checkInCountdownActive: false,
  checkInCountdownSeconds: 0,
  isAudioPermissionGranted: false,
  activeIncidentId: null,

  startGuardian: async () => {
    set({ status: 'starting', error: null });

    const permissions = await requestGuardianPermissions();
    if (!permissions.foreground || !permissions.background) {
      set({ status: 'idle', error: 'Izin lokasi tidak lengkap. Guardian tidak dapat dimulai.' });
      return;
    }

    try {
      await startGuardianSession();

      // Subscribe to Accelerometer
      startAccelerometerMonitoring(({ x, y, z }) => {
        const signal = calculateAccelerometerRisk(x, y, z);
        if (signal.score > 0) {
          get().setRiskScore(get().riskScore + signal.score, signal.label);
        }
      });

      const nextTime = new Date(Date.now() + SAFETY_CHECKIN.INTERVAL_MS).toISOString();

      if (schedulerInterval) {
        clearInterval(schedulerInterval);
      }

      schedulerInterval = setInterval(() => {
        const state = get();
        if (!state.active) return;

        // 1. Natural decay of risk score
        if (state.riskScore > 0 && state.status === 'active') {
          const nextScore = Math.max(state.riskScore - 2, 0); // slow decay by 2 per second
          set({
            riskScore: nextScore,
            riskLevel: determineRiskLevel(nextScore),
            ...(nextScore === 0 ? { lastRiskSignal: null } : {}),
          });
        }

        // 2. Check safety check-in countdown
        if (state.checkInCountdownActive) {
          const nextSec = state.checkInCountdownSeconds - 1;
          if (nextSec <= 0) {
            set({ checkInCountdownSeconds: 0 });
            if (schedulerInterval) {
              clearInterval(schedulerInterval);
              schedulerInterval = null;
            }
            get().triggerSOS('no_response');
          } else {
            set({ checkInCountdownSeconds: nextSec });
          }
        } else if (state.nextCheckInAt && state.status === 'active') {
          const now = Date.now();
          const due = new Date(state.nextCheckInAt).getTime();
          if (now >= due) {
            set({
              checkInCountdownActive: true,
              checkInCountdownSeconds: SAFETY_CHECKIN.GRACE_PERIOD_SECONDS,
            });
          }
        }
      }, 1000);

      set({
        active: true,
        status: 'active',
        startedAt: new Date().toISOString(),
        nextCheckInAt: nextTime,
        isAudioPermissionGranted: permissions.audio,
        error: null,
      });
    } catch (error) {
      stopAccelerometerMonitoring();
      if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
      }
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
      stopAccelerometerMonitoring();
      stopLiveBroadcast();
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
      }
    } catch {
      // ignore
    }
    set({
      active: false,
      status: 'idle',
      startedAt: null,
      riskScore: 0,
      riskLevel: 'low',
      lastLocation: null,
      lastRiskSignal: null,
      countdownActive: false,
      countdownSeconds: 5,
      countdownType: null,
      nextCheckInAt: null,
      checkInCountdownActive: false,
      checkInCountdownSeconds: 0,
      activeIncidentId: null,
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
    
    const activeIncidentId = get().activeIncidentId;
    if (activeIncidentId) {
      supabase.auth.getSession().then((sessionRes) => {
        const userId = sessionRes.data.session?.user?.id;
        if (userId) {
          const coords = {
            latitude: location.latitude,
            longitude: location.longitude,
            speed: location.speed,
            heading: null,
            accuracy: location.accuracy ?? 0,
            timestamp: new Date(location.timestamp).toISOString(),
          };
          
          broadcastLocation(activeIncidentId, userId, coords).catch((err) => {
            console.error('Failed to broadcast location:', err);
          });
          
          persistLocationHistory(activeIncidentId, coords).catch((err) => {
            console.error('Failed to persist location history:', err);
          });
        }
      }).catch((err) => {
        console.error('Failed to fetch session for location broadcast:', err);
      });
    }
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

  confirmSafety: () => {
    const nextTime = new Date(Date.now() + SAFETY_CHECKIN.INTERVAL_MS).toISOString();
    set({
      checkInCountdownActive: false,
      checkInCountdownSeconds: 0,
      nextCheckInAt: nextTime,
      riskScore: 0,
      riskLevel: 'low',
      lastRiskSignal: null,
    });
  },

  triggerSOS: async (triggerType) => {
    const state = get();
    if (state.status === 'sos_triggered') {
      return;
    }

    set({ status: 'sos_triggered', countdownActive: false, countdownType: null, error: null });
    try {
      const response = await triggerSOSRequest({
        triggerType,
        location: {
          latitude: state.lastLocation?.latitude ?? 0,
          longitude: state.lastLocation?.longitude ?? 0,
          accuracy: state.lastLocation?.accuracy ?? undefined,
          speed: state.lastLocation?.speed,
          heading: null,
        },
        riskScore: state.riskScore,
        keywordsDetected: [],
      });

      const incidentId = response.incident?.id;
      if (incidentId) {
        set({ activeIncidentId: incidentId });
        
        try {
          const sessionRes = await supabase.auth.getSession();
          const userId = sessionRes.data.session?.user?.id;
          if (userId) {
            startLiveBroadcast(incidentId, userId);
          }
        } catch (err) {
          console.warn('Failed to start live broadcast:', err);
        }

        startRecordingSession(incidentId).catch((err) => console.warn('Failed to start audio recording:', err));
        router.replace(`/incidents/${incidentId}`);
      }
    } catch (error) {
      set({
        error: (error as Error)?.message ?? 'Gagal mengirim SOS. Coba lagi.',
      });
    }
  },
}));
