import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { ThemedView } from "@/components/themed-view";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { SectionHeader } from "@/components/ui/section-header";
import { HandshakeContainer } from "@/app/features/handshake/HandshakeContainer";

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

          <HandshakeContainer />

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
  navigationSection: {
    paddingTop: 16,
  },
});
