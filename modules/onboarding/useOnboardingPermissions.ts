import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import {
  type OnboardingPermissionStatus,
  type PermissionCheckResult
} from '@/modules/onboarding/bluetoothPermission';
import { createSecureStoreReadinessChecker } from '@/modules/onboarding/secureStoreReadiness';

export type OnboardingPermissionStepKey = 'camera' | 'secureStore';
export type OnboardingTerminalState =
  | 'in_progress'
  | 'ready_to_continue'
  | 'blocked_by_permissions';

interface OnboardingPermissionStep {
  label: string;
  status: OnboardingPermissionStatus;
  errorMessage?: string;
}

type StepStateMap = Record<OnboardingPermissionStepKey, OnboardingPermissionStep>;

interface PermissionLike {
  granted: boolean;
  canAskAgain: boolean;
}

interface UseOnboardingPermissionsPorts {
  camera?: {
    currentPermission: PermissionLike | null;
    requestPermission: () => Promise<PermissionLike>;
  };
  secureStore?: {
    checkReadiness: () => Promise<PermissionCheckResult>;
  };
}

const STEP_ORDER: OnboardingPermissionStepKey[] = ['camera', 'secureStore'];

const STEP_LABELS: Record<OnboardingPermissionStepKey, string> = {
  camera: 'Camera',
  secureStore: 'Secure key storage',
};

const FRIENDLY_FAILURE_COPY: Record<string, string> = {
  CAMERA_PERMISSION_BLOCKED: `Camera access is required for secure QR verification. ${platformSettingsGuidance('camera')}`,
  SECURESTORE_PERMISSION_BLOCKED: `Secure storage access is required to protect identity keys. ${platformSettingsGuidance('secure storage')}`,
};

function platformSettingsGuidance(target: 'camera' | 'nearby devices' | 'secure storage'): string {
  if (Platform.OS === 'ios') {
    return `Open Settings > Comrades > ${target === 'secure storage' ? 'Face ID/Passcode permissions' : target} and allow access.`;
  }

  return `Open Settings > Apps > Comrades > Permissions > ${target} and allow access.`;
}
function normalizePermissionErrorMessage(
  key: OnboardingPermissionStepKey,
  result: PermissionCheckResult,
  wasPermanentlyDenied: boolean
): string | undefined {
  if (!result.errorMessage) {
    return undefined;
  }

  if (key === 'camera' && wasPermanentlyDenied) {
    return FRIENDLY_FAILURE_COPY.CAMERA_PERMISSION_BLOCKED;
  }

  if (result.status !== 'blocked') {
    return result.errorMessage;
  }

  const [baseReason] = result.errorMessage.split(':');
  const normalizedReason = baseReason.trim().toUpperCase();

  return FRIENDLY_FAILURE_COPY[normalizedReason] ?? result.errorMessage;
}

function createInitialSteps(): StepStateMap {
  return {
    camera: { label: STEP_LABELS.camera, status: 'idle' },
    secureStore: { label: STEP_LABELS.secureStore, status: 'idle' },
  };
}

export function useOnboardingPermissions(ports: UseOnboardingPermissionsPorts = {}) {
  const [steps, setSteps] = useState<StepStateMap>(createInitialSteps);

  const requestPermissions: () => Promise<PermissionCheckResult> = async () => {
    if (Platform.OS === 'android') {
      const allowed = await PermissionsAndroid.requestMultiple(
        [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        ]
      )
      const allAllowed = Object.values(allowed).every(v => v === 'granted')
      return {
        status: allAllowed ? 'granted' : 'denied'
      }
    } else if (Platform.OS === 'ios') {
      return Promise.resolve(
        {
          status: 'denied'
        }
      )
    }
    return {
      status: 'denied'
    }
  }


  const runStep = useCallback(async (key: OnboardingPermissionStepKey): Promise<PermissionCheckResult> => {
    setSteps((previous) => ({
      ...previous,
      [key]: { ...previous[key], status: 'requesting', errorMessage: undefined },
    }));

    let result: PermissionCheckResult;
    if (key === 'camera') {
      result = await requestPermissions();
    } else {
      const checker = await createSecureStoreReadinessChecker();
      result = await checker()
    }

    const normalizedErrorMessage = normalizePermissionErrorMessage(
      key,
      result,
      key === 'camera' && result.errorMessage === 'camera_permission_blocked' && result.status === 'blocked'
    );

    setSteps((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        status: result.status,
        errorMessage: normalizedErrorMessage,
      },
    }));

    return {
      ...result,
      errorMessage: normalizedErrorMessage,
    };
  }, [createSecureStoreReadinessChecker, requestPermissions]);

  const runChecksFromStep = useCallback(async (startKey: OnboardingPermissionStepKey): Promise<void> => {
    const startIndex = STEP_ORDER.indexOf(startKey);
    const stepsToRun = STEP_ORDER.slice(startIndex);

    for (const key of stepsToRun) {
      const result = await runStep(key);

      if (result.status === 'denied' || result.status === 'blocked') {
        return;
      }
    }
  }, [runStep]);

  useEffect(() => {
    void runChecksFromStep('camera');
    // Intentionally run once on mount to avoid repeated permission prompts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryStep = useCallback(async (key: OnboardingPermissionStepKey) => {
    await runChecksFromStep(key);
  }, [runChecksFromStep]);

  const grantedCount = STEP_ORDER.filter((key) => steps[key].status === 'granted').length;
  const totalCount = STEP_ORDER.length;
  const isReady = grantedCount === totalCount;

  const terminalState: OnboardingTerminalState = isReady
    ? 'ready_to_continue'
    : steps.camera.status === 'denied' ||
        steps.camera.status === 'blocked' ||
        steps.secureStore.status === 'denied' ||
        steps.secureStore.status === 'blocked'
      ? 'blocked_by_permissions'
      : 'in_progress';

  return {
    steps,
    orderedSteps: STEP_ORDER.map((key) => ({ key, ...steps[key] })),
    grantedCount,
    totalCount,
    isReady,
    terminalState,
    retryStep,
  };
}
