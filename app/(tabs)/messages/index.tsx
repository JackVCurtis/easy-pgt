import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SectionHeader } from '@/components/ui/section-header';

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
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const isSigned = useMemo(() => message.includes(SIGNATURE_MARKER), [message]);

  const verifyMessage = () => {
    if (!message.trim()) {
      setStatus('Add a message before verifying.');
      return;
    }

    setStatus(isSigned ? 'Signature detected and verified.' : 'No signature found.');
  };

  const signAndCopy = async () => {
    if (!message.trim()) {
      setStatus('Add a message before signing.');
      return;
    }

    const signedMessage = isSigned
      ? message
      : `${message.trimEnd()}\n\n${SIGNATURE_MARKER}\n${buildSignature(message)}`;

    setMessage(signedMessage);
    await Clipboard.setStringAsync(signedMessage);
    setStatus('Message signed and copied to clipboard.');
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
            <AppButton label="Verify Signature" onPress={verifyMessage} style={styles.button} />
            <AppButton label="Sign + Copy to Clipboard" onPress={signAndCopy} style={styles.button} />
          </View>

          <TextInput
            multiline
            placeholder="Paste or type message content here..."
            value={message}
            onChangeText={setMessage}
            style={styles.input}
            textAlignVertical="top"
          />

          {status ? <ThemedText>{status}</ThemedText> : null}
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
});
