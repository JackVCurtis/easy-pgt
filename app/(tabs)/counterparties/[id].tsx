import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { getCounterpartyById, updateCounterparty } from '@/app/handshake/counterparty-store';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SectionHeader } from '@/components/ui/section-header';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function CounterpartyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const counterparty = useMemo(() => (id ? getCounterpartyById(id) : undefined), [id]);

  const inputBackgroundColor = useThemeColor({}, 'backgroundSecondary');
  const inputBorderColor = useThemeColor({}, 'borderSubtle');
  const inputTextColor = useThemeColor({}, 'text');

  const [providedName, setProvidedName] = useState(counterparty?.providedName ?? '');
  const [contactInfo, setContactInfo] = useState(counterparty?.contactInfo ?? '');

  if (!counterparty) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppCard>
            <SectionHeader title="Counterparty Details" subtitle="This counterparty was not found." />
            <AppButton label="Back to Counterparties" onPress={() => router.back()} />
          </AppCard>
        </ScrollView>
      </ThemedView>
    );
  }

  const handleSave = () => {
    updateCounterparty(counterparty.id, {
      providedName: providedName.trim() || counterparty.providedName,
      contactInfo: contactInfo.trim() || undefined,
    });

    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard>
          <SectionHeader title="Counterparty Details" subtitle="Edit the saved name and optional contact info." />
          <View style={styles.formField}>
            <ThemedText type="defaultSemiBold">Name</ThemedText>
            <TextInput
              placeholder="Counterparty name"
              placeholderTextColor="#8A8A8A"
              value={providedName}
              onChangeText={setProvidedName}
              style={[
                styles.input,
                {
                  backgroundColor: inputBackgroundColor,
                  borderColor: inputBorderColor,
                  color: inputTextColor,
                },
              ]}
            />
          </View>
          <View style={styles.formField}>
            <ThemedText type="defaultSemiBold">Contact Info (optional)</ThemedText>
            <TextInput
              placeholder="Signal, email, or phone"
              placeholderTextColor="#8A8A8A"
              value={contactInfo}
              onChangeText={setContactInfo}
              style={[
                styles.input,
                {
                  backgroundColor: inputBackgroundColor,
                  borderColor: inputBorderColor,
                  color: inputTextColor,
                },
              ]}
            />
          </View>

          <AppButton label="Save" onPress={handleSave} />
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
  formField: {
    gap: 8,
    marginBottom: 12,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 16,
  },
});
