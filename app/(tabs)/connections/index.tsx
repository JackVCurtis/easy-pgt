import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getDirectConnections, toCounterpartyView, type CounterpartyView } from '@/app/state/appState';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';

export default function ConnectionsScreen() {
  const [counterparties, setCounterparties] = useState<CounterpartyView[]>(
    getDirectConnections().map(toCounterpartyView)
  );

  useFocusEffect(
    useCallback(() => {
      setCounterparties(getDirectConnections().map(toCounterpartyView));
    }, [])
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard>
          <SectionHeader
            title="Connections"
            subtitle="Only direct, named connections are shown here."
          />
          {counterparties.map((counterparty) => (
            <View key={counterparty.id} style={styles.item}>
              <ThemedText type="defaultSemiBold">{counterparty.providedName}</ThemedText>
              <StatusBadge
                label={counterparty.handshakeStatus === 'verified' ? 'Handshake Verified' : 'Handshake Pending'}
                tone={counterparty.handshakeStatus === 'verified' ? 'success' : 'warning'}
              />
              <AppButton
                label="Edit Details"
                onPress={() =>
                  router.push({
                    pathname: '/connections/[id]',
                    params: { id: counterparty.id },
                  })
                }
              />
            </View>
          ))}
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
  item: {
    gap: 8,
    marginBottom: 16,
  },
});
