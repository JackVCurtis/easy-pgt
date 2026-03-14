import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getDirectCounterparties, type Counterparty } from '@/app/handshake/counterparty-store';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';

export default function CounterpartiesScreen() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>(getDirectCounterparties());

  useFocusEffect(
    useCallback(() => {
      setCounterparties(getDirectCounterparties());
    }, [])
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard>
          <SectionHeader
            title="Counterparties"
            subtitle="Only direct, named counterparties are shown here."
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
                    pathname: '/counterparties/[id]',
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
