import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { addHandshakeCounterparty } from '@/app/handshake/connection-store';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SectionHeader } from '@/components/ui/section-header';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ProximityBootstrapPanel } from '@/app/features/proximity/ProximityBootstrapPanel';

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

type ExchangeStatusTone = 'neutral' | 'warning' | 'success';

function getExchangeStatus(stepIndex: number): { label: string; tone: ExchangeStatusTone } {
  if (stepIndex <= 0) {
    return { label: 'Starting handshake', tone: 'neutral' };
  }

  if (stepIndex >= EXCHANGE_STEPS.length) {
    return { label: 'Handshake verified', tone: 'success' };
  }

  return { label: EXCHANGE_STEPS[stepIndex].label, tone: 'warning' };
}

export default function HandshakeScreen() {
  const inputBackgroundColor = useThemeColor({}, 'backgroundSecondary');
  const inputBorderColor = useThemeColor({}, 'borderSubtle');
  const inputTextColor = useThemeColor({}, 'text');
  const mutedTextColor = useThemeColor({}, 'textMuted');
  const statusNeutralColor = useThemeColor({}, 'neutral');
  const statusWarningColor = useThemeColor({}, 'warning');
  const statusSuccessColor = useThemeColor({}, 'success');

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

  const exchangeStatus = useMemo(() => getExchangeStatus(exchangeStepIndex), [exchangeStepIndex]);

  const statusColor =
    exchangeStatus.tone === 'success'
      ? statusSuccessColor
      : exchangeStatus.tone === 'warning'
        ? statusWarningColor
        : statusNeutralColor;

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
      <AppCard style={styles.card}>
        <View style={styles.mainContent}>
          <SectionHeader
            title="Handshake"
            subtitle="Share your name, exchange trust payloads, and then review connections on their own screen."
          />

          <View style={styles.flowContent}>
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

              <View style={styles.statusRow}>
                <MaterialIcons
                  name={exchangeStatus.tone === 'success' ? 'check-circle' : 'autorenew'}
                  size={24}
                  color={statusColor}
                />
                <View style={styles.statusTextGroup}>
                  <ThemedText type="defaultSemiBold">{exchangeStatus.label}</ThemedText>
                  <ThemedText style={{ color: mutedTextColor }}>
                    {exchangeStatus.tone === 'warning' ? 'In progress' : 'Waiting'}
                  </ThemedText>
                </View>
              </View>
            </View>
          ) : null}

          {stage === 'complete' ? (
            <View style={styles.flowSection}>
              <ThemedText type="subtitle">Handshake complete</ThemedText>
              {handshakedProfileSummary ? (
                <>
                  <ThemedText>Connected with {handshakedProfileSummary.counterpartyName}.</ThemedText>
                  <ThemedText>Name you shared: {handshakedProfileSummary.nameShared}</ThemedText>

                  <View style={styles.mutualConnectionsSection}>
                    <ThemedText type="defaultSemiBold">Mutual connections (1 step)</ThemedText>
                    <ThemedText>
                      You → Jordan Miles → {handshakedProfileSummary.counterpartyName}
                    </ThemedText>
                    <ThemedText>
                      You → Riley Chen → {handshakedProfileSummary.counterpartyName}
                    </ThemedText>
                  </View>
                </>
              ) : null}
              <AppButton label="Start Another Handshake" onPress={startHandshake} />
            </View>
          ) : null}

          {stage === 'idle' ? <AppButton label="Start Handshake" onPress={startHandshake} /> : null}
          </View>

          <View style={styles.previewSection}>
            <AppButton label="Open Connections" onPress={() => router.push('/connections')} />
            <ProximityBootstrapPanel />
          </View>
        </View>
      </AppCard>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  card: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  flowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  flowSection: {
    gap: 12,
  },
  previewSection: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  statusTextGroup: {
    gap: 2,
  },
  mutualConnectionsSection: {
    gap: 4,
    marginTop: 4,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 16,
  },
});
