import { useRouter } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';

import { markOnboardingCompleted } from '@/app/onboarding/onboardingState';
import { useOnboardingPermissions } from '@/app/onboarding/useOnboardingPermissions';

const STATUS_LABELS = {
  idle: 'Idle',
  requesting: 'Checking…',
  granted: 'Granted',
  denied: 'Denied',
  blocked: 'Blocked',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { orderedSteps, grantedCount, totalCount, isReady, retryStep } = useOnboardingPermissions();

  const handleContinue = async () => {
    if (!isReady) {
      return;
    }

    await markOnboardingCompleted();
    router.replace('/handshake');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Comrades</Text>
      <Text style={styles.body}>
        Confirm permissions before starting handshake flows to avoid interruptions.
      </Text>
      <Text style={styles.progress}>Permissions ready: {grantedCount}/{totalCount}</Text>

      <View style={styles.checklist}>
        {orderedSteps.map((step) => (
          <View key={step.key} style={styles.checklistRow}>
            <Text style={styles.stepTitle}>{step.label}: {STATUS_LABELS[step.status]}</Text>
            {step.errorMessage ? <Text style={styles.errorText}>{step.errorMessage}</Text> : null}
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
    color: '#7f1d1d',
  },
});
