import { useRouter } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';

import { markOnboardingCompleted } from '@/app/onboarding/onboardingState';
import { type OnboardingPermissionStepKey, useOnboardingPermissions } from '@/app/onboarding/useOnboardingPermissions';

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
      key: 'prepare_secure_storage',
      label: 'Preparing secure storage',
      status: toTimelineStatus(steps.secureStore.status),
    },
    {
      key: 'generate_identity_keypair',
      label: 'Generating identity keypair',
      status: toTimelineStatus(steps.initializing_keys.status),
    },
    {
      key: 'verify_stored_keypair',
      label: 'Verifying stored keypair',
      status: toTimelineStatus(steps.initializing_keys.status),
    },
  ];
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { orderedSteps, grantedCount, totalCount, isReady, retryStep, steps, terminalState } = useOnboardingPermissions();
  const timeline = buildTimeline(steps);

  const handleContinue = async () => {
    if (!isReady) {
      return;
    }

    await markOnboardingCompleted();
    router.replace('/handshake');
  };

  const initializationStep = steps.initializing_keys;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Comrades</Text>
      <Text style={styles.body}>
        Confirm required permissions and secure key initialization before starting handshake flows.
      </Text>
      <Text style={styles.progress}>Permissions ready: {grantedCount}/{totalCount}</Text>
      <Text style={styles.progress}>Security status: {terminalState}</Text>
      {!isReady ? <Text style={styles.errorText}>Skip is unavailable because this is a hard security requirement.</Text> : null}

      <View style={styles.checklist}>
        {timeline.map((entry) => (
          <Text key={entry.key} style={styles.stepTitle}>{entry.label}: {timelineLabel(entry.status)}</Text>
        ))}
      </View>

      <View style={styles.checklist}>
        {orderedSteps.map((step) => (
          <View key={step.key} style={styles.checklistRow}>
            <Text style={styles.stepTitle}>{step.label}: {STATUS_LABELS[step.status]}</Text>
            {step.errorMessage ? <Text style={styles.errorText}>{step.errorMessage}</Text> : null}
            {(step.status === 'denied' || step.status === 'blocked') && step.key !== 'initializing_keys' ? (
              <Button title={`Retry ${step.label}`} onPress={() => void retryStep(step.key)} />
            ) : null}
          </View>
        ))}
      </View>

      {(initializationStep.status === 'denied' || initializationStep.status === 'blocked') ? (
        <Button title="Retry initialization" onPress={() => void retryStep('initializing_keys')} />
      ) : null}

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
    color: '#7f1d1d',
  },
});
