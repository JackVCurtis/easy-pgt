import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { SectionHeader } from "@/components/ui/section-header";

export default function HandshakeScreen() {
  return (
    <ThemedView style={styles.container}>
      <AppCard style={styles.card}>
        <ScrollView
          testID="handshake-scroll-column"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SectionHeader
            title="Handshake"
            subtitle="Offer or accept a handshake to begin nearby trust exchange."
          />

          <View style={styles.flowContent}>
            <View style={styles.flowSection}>
              <AppButton label="Offer Hand" onPress={() => {}} />
              <AppButton label="Accept Handshake" onPress={() => {}} />
            </View>
          </View>

          <View style={styles.previewSection}>
            <ThemedText type="defaultSemiBold">Diagnostics</ThemedText>
            <ThemedText>
              Handshake diagnostics will appear here once a handshake is
              initiated.
            </ThemedText>
          </View>

          <View style={styles.navigationSection}>
            <AppButton
              label="Open Connections"
              onPress={() => router.push("/connections")}
            />
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  flowContent: {
    gap: 16,
    paddingTop: 8,
  },
  flowSection: {
    gap: 12,
  },
  previewSection: {
    gap: 8,
    paddingTop: 16,
  },
  navigationSection: {
    paddingTop: 16,
  },
});
