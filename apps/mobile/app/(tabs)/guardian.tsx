import { View, Text, ScrollView, Pressable } from 'react-native';
import { useEffect } from 'react';
import { useGuardian } from '../../src/hooks/useGuardian';
import { Button } from '../../src/components/ui/Button';
import { CountdownOverlay } from '../../src/components/guardian/CountdownOverlay';
import { RiskLevelIndicator } from '../../src/components/guardian/RiskLevelIndicator';
import { SensorStatusList } from '../../src/components/guardian/SensorStatusList';

export default function GuardianPage() {
  const {
    active,
    status,
    riskScore,
    riskLevel,
    lastLocation,
    lastRiskSignal,
    countdownActive,
    countdownSeconds,
    error,
    nextCheckInAt,
    checkInCountdownActive,
    checkInCountdownSeconds,
    isAudioPermissionGranted,
    startGuardian,
    stopGuardian,
    beginCountdown,
    cancelCountdown,
    confirmSafety,
  } = useGuardian();

  useEffect(() => {
    if (!active && status === 'idle') {
      // no-op
    }
  }, [active, status]);

  const sensorStatuses = [
    { label: 'GPS', active: !!lastLocation },
    { label: 'Microphone', active: isAudioPermissionGranted },
    { label: 'Accelerometer', active: active },
    { label: 'Notification', active: true },
  ];

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-3xl font-bold text-white">Guardian Mode</Text>
        <Text className="mt-2 text-slate-300">Aktifkan guardian untuk menjaga keamananmu selama bergerak.</Text>

        <View className="mt-8 space-y-5">
          <RiskLevelIndicator riskLevel={riskLevel} score={riskScore} />
          <SensorStatusList statuses={sensorStatuses} />

          {active && (
            checkInCountdownActive ? (
              <View className="rounded-3xl bg-rose-950 p-5 border border-rose-700 items-center">
                <Text className="text-xl font-bold text-white text-center">🛡️ Safety Check-In!</Text>
                <Text className="text-slate-300 mt-2 text-center text-sm">Konfirmasi bahwa Anda aman dalam:</Text>
                <Text className="text-4xl font-extrabold text-pink-400 mt-3">{checkInCountdownSeconds}s</Text>
                <Pressable onPress={confirmSafety} className="mt-5 w-full bg-emerald-600 rounded-3xl p-4 items-center active:bg-emerald-500">
                  <Text className="text-white font-bold text-lg">Saya Aman (Extend)</Text>
                </Pressable>
              </View>
            ) : (
              <View className="rounded-3xl bg-slate-900 p-5">
                <Text className="text-sm font-semibold uppercase text-slate-400">Jadwal Safety Check-in</Text>
                <Text className="text-white font-semibold text-lg mt-3">
                  Next check-in: {nextCheckInAt ? new Date(nextCheckInAt).toLocaleTimeString() : '-'}
                </Text>
                <Text className="text-slate-400 text-xs mt-1">Anda perlu menekan tombol konfirmasi saat diminta.</Text>
                <Pressable onPress={confirmSafety} className="mt-4 border border-dashed border-slate-700 p-3 rounded-2xl items-center active:bg-slate-800">
                  <Text className="text-xs text-slate-300 font-semibold">Konfirmasi Sekarang (Reset Timer)</Text>
                </Pressable>
              </View>
            )
          )}

          <View className="rounded-3xl bg-slate-900 p-4">
            <Text className="text-sm font-semibold uppercase text-slate-400">Location terakhir</Text>
            <Text className="mt-3 text-slate-200">
              {lastLocation
                ? `${lastLocation.latitude.toFixed(5)}, ${lastLocation.longitude.toFixed(5)}`
                : 'Belum ada lokasi terkini'}
            </Text>
          </View>

          <View className="rounded-3xl bg-slate-900 p-4">
            <Text className="text-sm font-semibold uppercase text-slate-400">Last Risk Signal</Text>
            <Text className="mt-3 text-slate-200">{lastRiskSignal ?? 'Tidak ada'}</Text>
          </View>

          <View className="space-y-4">
            {active ? (
              <Button title="Stop Guardian" onPress={stopGuardian} variant="secondary" />
            ) : (
              <Button title="Activate Guardian" onPress={startGuardian} />
            )}
            <Button title="Manual SOS" onPress={() => beginCountdown('manual')} />
          </View>

          {error ? <Text className="text-red-400">{error}</Text> : null}
        </View>
      </ScrollView>

      {countdownActive ? (
        <CountdownOverlay seconds={countdownSeconds} onCancel={cancelCountdown} triggerType={status === 'countdown' ? 'manual' : 'risk_engine'} />
      ) : null}
    </View>
  );
}
