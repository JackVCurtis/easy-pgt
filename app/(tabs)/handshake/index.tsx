import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { addHandshakeCounterparty } from '@/app/handshake/connection-store';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { useThemeColor } from '@/hooks/use-theme-color';

type HandshakeStepStatus = 'pending' | 'active' | 'complete';
type HandshakeStage = 'idle' | 'collecting' | 'exchanging' | 'complete';

type ExchangeStep = {
  id: string;
  label: string;
};

const EXCHANGE_STEPS: ExchangeStep[] = [
  { id: 'connect', label: 'Connecting to nearby device' },
  { id: 'exchange', label: 'Exchanging public trust payloads' },
  { id: 'merge', label: 'Verifying and merging trust tree entries' },
  { id: 'complete', label: 'Finalizing handshake record' },
];

const EXCHANGE_STEP_DURATION_MS = 800;

function getStepStatus(stepIndex: number, currentStep: number): HandshakeStepStatus {
  if (stepIndex < currentStep) {
    return 'complete';
  }

  if (stepIndex === currentStep) {
    return 'active';
  }

  return 'pending';
}

function getBadgeTone(status: HandshakeStepStatus): 'neutral' | 'warning' | 'success' {
  if (status === 'complete') {
    return 'success';
  }

  if (status === 'active') {
    return 'warning';
  }

  return 'neutral';
}

function getBadgeLabel(status: HandshakeStepStatus): string {
  if (status === 'complete') {
    return 'Complete';
  }

  if (status === 'active') {
    return 'In Progress';
  }

  return 'Waiting';
}

export default function HandshakeScreen() {
  const inputBackgroundColor = useThemeColor({}, 'backgroundSecondary');
  const inputBorderColor = useThemeColor({}, 'borderSubtle');
  const inputTextColor = useThemeColor({}, 'text');

  const [stage, setStage] = useState<HandshakeStage>('idle');
  const [nameToShare, setNameToShare] = useState('');
  const [contactMethodDraft, setContactMethodDraft] = useState('');
  const [exchangeStepIndex, setExchangeStepIndex] = useState(0);
  const [newCounterpartyName, setNewCounterpartyName] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== 'exchanging') {
      return;
    }

    if (exchangeStepIndex >= EXCHANGE_STEPS.length) {
      const created = addHandshakeCounterparty({
        localSharedName: nameToShare.trim(),
        contactInfo: contactMethodDraft.trim() || undefined,
      });

      setNewCounterpartyName(created.providedName);
      setStage('complete');
      return;
    }

    const timeout = setTimeout(() => {
      setExchangeStepIndex((currentIndex) => currentIndex + 1);
    }, EXCHANGE_STEP_DURATION_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [contactMethodDraft, exchangeStepIndex, nameToShare, stage]);

  const canContinue = nameToShare.trim().length > 0;

  const handshakedProfileSummary = useMemo(() => {
    if (stage !== 'complete' || !newCounterpartyName) {
      return null;
    }

    return {
      counterpartyName: newCounterpartyName,
      nameShared: nameToShare.trim(),
    };
  }, [nameToShare, newCounterpartyName, stage]);

  const startHandshake = () => {
    setStage('collecting');
    setNameToShare('');
    setContactMethodDraft('');
    setExchangeStepIndex(0);
    setNewCounterpartyName(null);
  };

  const beginExchange = () => {
    setExchangeStepIndex(0);
    setStage('exchanging');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard>
          <SectionHeader
            title="Handshake"
            subtitle="Share your name, exchange trust payloads, and then review connections on their own screen."
          />

          {stage === 'collecting' ? (
            <View style={styles.flowSection}>
              <ThemedText type="subtitle">Share details for this handshake</ThemedText>
              <ThemedText>
                The name entered here is what you provide to the other person. Their provided name is saved after exchange.
              </ThemedText>

              <TextInput
                placeholder="Enter the name you want to share"
                placeholderTextColor="#8A8A8A"
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    color: inputTextColor,
                  },
                ]}
                value={nameToShare}
                onChangeText={setNameToShare}
              />

              <TextInput
                placeholder="Add contact info for this connection (optional)"
                placeholderTextColor="#8A8A8A"
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    color: inputTextColor,
                  },
                ]}
                value={contactMethodDraft}
                onChangeText={setContactMethodDraft}
              />

              <AppButton
                label="Continue to NFC exchange"
                onPress={beginExchange}
                disabled={!canContinue}
              />
            </View>
          ) : null}

          {stage === 'exchanging' ? (
            <View style={styles.flowSection}>
              <ThemedText type="subtitle">Hold phones next to each other</ThemedText>
              <ThemedText>
                Keep both devices close while we simulate NFC payload exchange and trust tree verification.
              </ThemedText>

              {EXCHANGE_STEPS.map((step, index) => {
                const status = getStepStatus(index, exchangeStepIndex);

                return (
                  <View key={step.id} style={styles.item}>
                    <ThemedText type="defaultSemiBold">{step.label}</ThemedText>
                    <StatusBadge label={getBadgeLabel(status)} tone={getBadgeTone(status)} />
                  </View>
                );
              })}
            </View>
          ) : null}

          {stage === 'complete' ? (
            <View style={styles.flowSection}>
              <ThemedText type="subtitle">Handshake complete</ThemedText>
              {handshakedProfileSummary ? (
                <>
                  <ThemedText>Connected with {handshakedProfileSummary.counterpartyName}.</ThemedText>
                  <ThemedText>Name you shared: {handshakedProfileSummary.nameShared}</ThemedText>
                </>
              ) : null}
              <AppButton label="View Connections" onPress={() => router.push('/connections')} />
              <AppButton label="Start Another Handshake" onPress={startHandshake} />
            </View>
          ) : null}

          {stage === 'idle' ? <AppButton label="Start Handshake" onPress={startHandshake} /> : null}

          <View style={styles.previewSection}>
            <AppButton label="Open Connections" onPress={() => router.push('/connections')} />
          </View>
        </AppCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  flowSection: {
    gap: 12,
    marginBottom: 16,
  },
  previewSection: {
    marginTop: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  item: {
    gap: 4,
    marginBottom: 4,
  },
});
