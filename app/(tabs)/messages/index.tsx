import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  getAllConnections,
  getMessageComposerState,
  setDraftMessage,
  setVerificationContext,
} from '@/app/state/appState';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SectionHeader } from '@/components/ui/section-header';
import { useThemeColor } from '@/hooks/use-theme-color';

const SIGNATURE_MARKER = '---SIGNATURE---';

function buildSignature(message: string) {
  const normalizedMessage = message.trim();

  if (!normalizedMessage) {
    return '';
  }

  const checksum = Array.from(normalizedMessage).reduce((acc, character, index) => {
    return (acc + character.charCodeAt(0) * (index + 1)) % 1000000007;
  }, 0);

  return `sig-${checksum.toString(16)}`;
}

export default function MessagesScreen() {
  const initialComposerState = getMessageComposerState();

  const [message, setMessage] = useState(initialComposerState.draftMessage);
  const [status, setStatus] = useState<string | null>(initialComposerState.verificationContext.status);
  const [senderDistances, setSenderDistances] = useState<string[]>(
    initialComposerState.verificationContext.senderDistances
  );

  const inputTextColor = useThemeColor({}, 'text');
  const inputBackgroundColor = useThemeColor({}, 'surface');
  const inputBorderColor = useThemeColor({}, 'border');
  const inputPlaceholderColor = useThemeColor({}, 'textMuted');

  const isSigned = useMemo(() => message.includes(SIGNATURE_MARKER), [message]);

  const updateComposerState = (nextMessage: string, nextStatus: string | null, nextDistances: string[]) => {
    setMessage(nextMessage);
    setStatus(nextStatus);
    setSenderDistances(nextDistances);
    setDraftMessage(nextMessage);
    setVerificationContext({
      status: nextStatus,
      senderDistances: nextDistances,
    });
  };

  const verifyMessage = () => {
    if (!message.trim()) {
      updateComposerState(message, 'Add a message before verifying.', []);
      return;
    }

    const verificationStatus = isSigned ? 'Signature detected and verified.' : 'No signature found.';
    const distances = getAllConnections().map(
      (connection) => `${connection.counterpartAlias}: ${connection.trustDepth} hop(s)`
    );

    updateComposerState(message, verificationStatus, distances);
  };

  const signAndCopy = () => {
    if (!message.trim()) {
      updateComposerState(message, 'Add a message before signing.', senderDistances);
      return;
    }

    const signedMessage = isSigned
      ? message
      : `${message.trimEnd()}\n\n${SIGNATURE_MARKER}\n${buildSignature(message)}`;

    updateComposerState(signedMessage, 'Message signed and copied to clipboard (mock).', senderDistances);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard>
          <SectionHeader
            title="Messages"
            subtitle="Paste or write message content, verify signatures, or sign and copy in one place."
          />

          <View style={styles.buttonRow}>
            <AppButton label="Verify Message" onPress={verifyMessage} style={styles.button} />
            <AppButton label="Sign + Copy to Clipboard" onPress={signAndCopy} style={styles.button} />
          </View>

          <TextInput
            multiline
            placeholder="Paste or type message content here..."
            placeholderTextColor={inputPlaceholderColor}
            value={message}
            onChangeText={setMessage}
            style={[
              styles.input,
              {
                color: inputTextColor,
                backgroundColor: inputBackgroundColor,
                borderColor: inputBorderColor,
              },
            ]}
            textAlignVertical="top"
          />

          {status ? <ThemedText>{status}</ThemedText> : null}

          {senderDistances.length > 0 ? (
            <View style={styles.distanceContainer}>
              <ThemedText type="defaultSemiBold">Sender distance from local connections</ThemedText>
              {senderDistances.map((distance) => (
                <ThemedText key={distance}>• {distance}</ThemedText>
              ))}
            </View>
          ) : null}
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
  },
  input: {
    minHeight: 280,
    borderWidth: 1,
    borderColor: '#A0A0A0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  distanceContainer: {
    marginTop: 8,
    gap: 4,
  },
});
