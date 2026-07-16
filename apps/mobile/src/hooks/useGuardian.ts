import { useGuardianStore } from '../stores/guardian-store';

export function useGuardian() {
  return useGuardianStore((state) => ({
    active: state.active,
    status: state.status,
    riskScore: state.riskScore,
    riskLevel: state.riskLevel,
    lastLocation: state.lastLocation,
    lastRiskSignal: state.lastRiskSignal,
    countdownActive: state.countdownActive,
    countdownSeconds: state.countdownSeconds,
    error: state.error,
    startGuardian: state.startGuardian,
    stopGuardian: state.stopGuardian,
    beginCountdown: state.beginCountdown,
    cancelCountdown: state.cancelCountdown,
  }));
}
