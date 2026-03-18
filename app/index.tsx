import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { hasCompletedOnboarding } from '@/app/onboarding/onboardingState';
import { unlockGate } from '@/app/security/unlockGate';

type RouteStatus = 'loading' | 'onboarding' | 'locked' | 'unlocked';

export default function Index() {
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('loading');

  useEffect(() => {
    let isMounted = true;

    const loadOnboardingStatus = async () => {
      const hasCompleted = await hasCompletedOnboarding();

      if (!isMounted) {
        return;
      }

      if (!hasCompleted) {
        setRouteStatus('onboarding');
        return;
      }

      const gateResult = await unlockGate();

      if (!isMounted) {
        return;
      }

      setRouteStatus(gateResult.status === 'unlocked' ? 'unlocked' : 'locked');
    };

    void loadOnboardingStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  if (routeStatus === 'loading') {
    return <View testID="root-route-loading" />;
  }

  if (routeStatus === 'onboarding') {
    return <Redirect href="/onboarding" />;
  }

  if (routeStatus === 'locked') {
    return <Redirect href="/lock" />;
  }

  return <Redirect href="/handshake" />;
}
