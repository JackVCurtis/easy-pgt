import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { ProximityDiagnosticEvent } from '@/app/features/proximity/useProximityBootstrap';

type HandshakeErrorModalProps = {
  visible: boolean;
  failureReason?: string;
  mappedMessage: string | null;
  diagnostic: string;
  diagnosticEvents: ProximityDiagnosticEvent[];
  onResetRetry: () => void;
};

export function HandshakeErrorModal({
  visible,
  failureReason,
  mappedMessage,
  diagnostic,
  diagnosticEvents,
  onResetRetry,
}: HandshakeErrorModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onResetRetry}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <ThemedText type="subtitle">Handshake Error</ThemedText>
          <ThemedText type="defaultSemiBold">Summary</ThemedText>
          {failureReason ? <ThemedText>Failure Reason: {failureReason}</ThemedText> : null}
          {mappedMessage ? <ThemedText>{mappedMessage}</ThemedText> : null}
          {diagnostic ? <ThemedText selectable style={styles.codeBlock}>{diagnostic}</ThemedText> : null}

          <ThemedText type="defaultSemiBold">Diagnostic Event Timeline</ThemedText>
          <ScrollView style={styles.timeline} contentContainerStyle={styles.timelineContent}>
            {diagnosticEvents.length === 0 ? (
              <ThemedText>No diagnostic events recorded.</ThemedText>
            ) : (
              diagnosticEvents.map((event) => (
                <ThemedText key={`${event.at}-${event.source}-${event.action}`} selectable style={styles.eventRow}>
                  {event.at} [{event.source}] {event.action}: {event.detail}
                </ThemedText>
              ))
            )}
          </ScrollView>

          <Pressable accessibilityRole="button" style={styles.resetButton} onPress={onResetRetry}>
            <ThemedText type="defaultSemiBold">Reset and Retry</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    maxHeight: '85%',
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    padding: 8,
  },
  timeline: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  timelineContent: {
    gap: 6,
    padding: 8,
  },
  eventRow: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  resetButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
