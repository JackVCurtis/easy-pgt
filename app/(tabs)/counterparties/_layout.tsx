import { Stack } from 'expo-router';

export default function CounterpartiesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Counterparties' }} />
      <Stack.Screen name="[id]" options={{ title: 'Counterparty Details' }} />
    </Stack>
  );
}
