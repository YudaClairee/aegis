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
    nextCheckInAt: state.nextCheckInAt,
    checkInCountdownActive: state.checkInCountdownActive,
    checkInCountdownSeconds: state.checkInCountdownSeconds,
    isAudioPermissionGranted: state.isAudioPermissionGranted,
    startGuardian: state.startGuardian,
    stopGuardian: state.stopGuardian,
    beginCountdown: state.beginCountdown,
    cancelCountdown: state.cancelCountdown,
    confirmSafety: state.confirmSafety,
  }));
}
