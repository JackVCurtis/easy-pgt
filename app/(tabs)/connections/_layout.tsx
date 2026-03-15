import { Stack } from 'expo-router';

export default function ConnectionsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Connections' }} />
      <Stack.Screen name="[id]" options={{ title: 'Connection Details' }} />
    </Stack>
  );
}
