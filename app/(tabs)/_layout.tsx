import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TRUST_FLOWS } from '@/app/navigation/flows';
import { getBottomTabBarStyle } from '@/app/navigation/tab-bar-style';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: getBottomTabBarStyle(),
      }}>
      {TRUST_FLOWS.map((flow) => (
        <Tabs.Screen
          key={flow.routeName}
          name={flow.routeName}
          options={{
            title: flow.title,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name={flow.icon} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
