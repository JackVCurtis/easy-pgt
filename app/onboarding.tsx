import { useRouter } from 'expo-router';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';

import { markOnboardingCompleted } from '@/app/onboarding/onboardingState';
import { type OnboardingPermissionStepKey, useOnboardingPermissions } from '@/app/onboarding/useOnboardingPermissions';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STATUS_LABELS = {
  idle: 'Idle',
  requesting: 'Checking…',
  granted: 'Granted',
  denied: 'Denied',
  blocked: 'Blocked',
};

type TimelineStatus = 'pending' | 'active' | 'completed' | 'failed';

type TimelineEntry = {
  key: string;
  label: string;
  status: TimelineStatus;
};

function toTimelineStatus(stepStatus: keyof typeof STATUS_LABELS): TimelineStatus {
  if (stepStatus === 'granted') {
    return 'completed';
  }

  if (stepStatus === 'requesting') {
    return 'active';
  }

  if (stepStatus === 'denied' || stepStatus === 'blocked') {
    return 'failed';
  }

  return 'pending';
}

function timelineLabel(status: TimelineStatus): string {
  if (status === 'completed') {
    return 'Completed';
  }

  if (status === 'active') {
    return 'In progress';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  return 'Pending';
}

function buildTimeline(steps: Record<OnboardingPermissionStepKey, { status: keyof typeof STATUS_LABELS }>): TimelineEntry[] {
  const permissionStatus = [steps.camera.status, steps.bluetooth.status].every((status) => status === 'granted')
    ? 'completed'
    : [steps.camera.status, steps.bluetooth.status].some((status) => status === 'denied' || status === 'blocked')
      ? 'failed'
      : [steps.camera.status, steps.bluetooth.status].some((status) => status === 'requesting')
        ? 'active'
        : 'pending';

  return [
    { key: 'request_permissions', label: 'Requesting permissions', status: permissionStatus },
    {
      label: 'Initializing app data encryption key',
      key: 'initialize_secure_storage',
      status: toTimelineStatus(steps.secureStore.status),
    },
  ];
}

export default function OnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { orderedSteps, grantedCount, totalCount, isReady, retryStep, steps, terminalState } = useOnboardingPermissions();
  const timeline = buildTimeline(steps);

  const handleContinue = async () => {
    if (!isReady) {
      return;
    }

    await markOnboardingCompleted();
    router.replace('/handshake');
  };

  const secureStoreStep = steps.secureStore;

  const isAndroid = Platform.OS === 'android';

  const secureStorageGuidance =
    secureStoreStep.status === 'granted' && secureStoreStep.errorMessage
      ? secureStoreStep.errorMessage
      : secureStoreStep.status === 'blocked'
        ? 'This device cannot enable authentication-protected secure storage. Sensitive setup may need to be deferred.'
        : secureStoreStep.status === 'denied'
          ? 'Device authentication was declined. Retry after enabling screen lock / biometrics in system settings.'
          : undefined;

  const iosSecureStorageGuidance =
    !isAndroid && secureStorageGuidance
      ? 'On iOS, enable a passcode and Face ID or Touch ID in Settings to improve secure-storage protection.'
      : undefined;

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>Welcome to Comrades</Text>
      <Text style={[styles.body, { color: palette.textMuted }]}>
        Allow camera and nearby devices access, then confirm secure encryption-key initialization before starting handshake flows.
      </Text>
      <Text style={[styles.progress, { color: palette.text }]}>Permissions ready: {grantedCount}/{totalCount}</Text>
      <Text style={[styles.progress, { color: palette.text }]}>Security status: {terminalState}</Text>
      {!isReady ? <Text style={[styles.errorText, { color: palette.danger }]}>Skip is unavailable because this is a hard security requirement.</Text> : null}

      {isAndroid && secureStorageGuidance ? (
        <View style={[styles.checklistRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.stepTitle, { color: palette.text }]}>Android secure storage readiness</Text>
          <Text style={[styles.body, { color: palette.textMuted }]}>{secureStorageGuidance}</Text>
          <Text style={[styles.body, { color: palette.textMuted }]}>
            This feature uses your device&apos;s secure lock screen / biometrics to protect sensitive data.
          </Text>
        </View>
      ) : null}

      <View style={styles.checklist}>
        {timeline.map((entry) => (
          <Text key={entry.key} style={[styles.stepTitle, { color: palette.text }]}>{entry.label}: {timelineLabel(entry.status)}</Text>
        ))}
      </View>

      <View style={styles.checklist}>
        {orderedSteps.map((step) => (
          <View key={step.key} style={[styles.checklistRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.stepTitle, { color: palette.text }]}>{step.label}: {STATUS_LABELS[step.status]}</Text>
            {step.errorMessage ? <Text style={[styles.errorText, { color: palette.danger }]}>{step.errorMessage}</Text> : null}
            {step.key === 'secureStore' && iosSecureStorageGuidance ? (
              <Text style={[styles.errorText, { color: palette.danger }]}>{iosSecureStorageGuidance}</Text>
            ) : null}
            {(step.status === 'denied' || step.status === 'blocked') ? (
              <Button title={`Retry ${step.label}`} onPress={() => void retryStep(step.key)} />
            ) : null}
          </View>
        ))}
      </View>

      <Button onPress={() => void handleContinue()} title="Continue" disabled={!isReady} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  progress: {
    textAlign: 'center',
    fontWeight: '500',
  },
  checklist: {
    gap: 12,
  },
  checklistRow: {
    gap: 6,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    padding: 10,
  },
  stepTitle: {
    fontWeight: '500',
  },
  errorText: {
    textAlign: 'center',
  },
});
