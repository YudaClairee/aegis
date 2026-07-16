import { View, Text, ScrollView } from 'react-native';
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
    startGuardian,
    stopGuardian,
    beginCountdown,
    cancelCountdown,
  } = useGuardian();

  useEffect(() => {
    if (!active && status === 'idle') {
      // no-op
    }
  }, [active, status]);

  const sensorStatuses = [
    { label: 'GPS', active: !!lastLocation },
    { label: 'Microphone', active: true },
    { label: 'Accelerometer', active: true },
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
