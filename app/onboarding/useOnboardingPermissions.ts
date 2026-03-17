import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useCameraPermissions } from 'expo-camera';

import {
  mapBlePermissionFailure,
  mapBleStateToPermissionResult,
  type OnboardingPermissionStatus,
  type PermissionCheckResult,
} from '@/app/onboarding/bluetoothPermission';
import { mapIdentityInitializationFailure } from '@/app/onboarding/identityInitialization';
import { probeSecureStoreReadiness } from '@/app/onboarding/secureStoreReadiness';
import { getOrCreateIdentityKeypair } from '@/app/protocol/crypto/identityKeyManager';

export type OnboardingPermissionStepKey = 'camera' | 'bluetooth' | 'secureStore' | 'initializing_keys';
export type OnboardingTerminalState =
  | 'in_progress'
  | 'ready_to_continue'
  | 'blocked_by_permissions'
  | 'blocked_by_key_init_failure';

interface OnboardingPermissionStep {
  label: string;
  status: OnboardingPermissionStatus;
  errorMessage?: string;
}

type StepStateMap = Record<OnboardingPermissionStepKey, OnboardingPermissionStep>;

interface BleManagerLike {
  state(): Promise<string>;
  destroy(): void;
}

interface CameraPermissionLike {
  granted: boolean;
  canAskAgain: boolean;
}

interface UseOnboardingPermissionsPorts {
  camera?: {
    currentPermission: CameraPermissionLike | null;
    requestPermission: () => Promise<CameraPermissionLike>;
  };
  bluetooth?: {
    checkReadiness: () => Promise<PermissionCheckResult>;
  };
  secureStore?: {
    checkReadiness: () => Promise<PermissionCheckResult>;
  };
  identity?: {
    initializeKeypair: () => Promise<PermissionCheckResult>;
  };
}

const STEP_ORDER: OnboardingPermissionStepKey[] = ['camera', 'bluetooth', 'secureStore', 'initializing_keys'];

const STEP_LABELS: Record<OnboardingPermissionStepKey, string> = {
  camera: 'Camera',
  bluetooth: 'Bluetooth',
  secureStore: 'Secure key storage',
  initializing_keys: 'Initializing keys',
};

const FRIENDLY_FAILURE_COPY: Record<string, string> = {
  CAMERA_PERMISSION_BLOCKED: `Camera access is required for secure QR verification. ${platformSettingsGuidance('camera')}`,
  BLUETOOTH_PERMISSION_BLOCKED: `Bluetooth access is required for authenticated nearby transport. ${platformSettingsGuidance('bluetooth')}`,
  SECURESTORE_PERMISSION_BLOCKED: `Secure storage access is required to protect identity keys. ${platformSettingsGuidance('secure storage')}`,
};

function platformSettingsGuidance(target: 'camera' | 'bluetooth' | 'secure storage'): string {
  if (Platform.OS === 'ios') {
    return `Open Settings > Comrades > ${target === 'secure storage' ? 'Face ID/Passcode permissions' : target} and allow access.`;
  }

  return `Open Settings > Apps > Comrades > Permissions > ${target} and allow access.`;
}

function normalizeFailureReason(reason: string): string {
  const [baseReason] = reason.split(':');
  return baseReason.trim().toUpperCase();
}

function normalizePermissionErrorMessage(
  key: Exclude<OnboardingPermissionStepKey, 'initializing_keys'>,
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

  const normalizedReason = normalizeFailureReason(`${key}_permission_blocked`);
  return FRIENDLY_FAILURE_COPY[normalizedReason] ?? result.errorMessage;
}

function createInitialSteps(): StepStateMap {
  return {
    camera: { label: STEP_LABELS.camera, status: 'idle' },
    bluetooth: { label: STEP_LABELS.bluetooth, status: 'idle' },
    secureStore: { label: STEP_LABELS.secureStore, status: 'idle' },
    initializing_keys: { label: STEP_LABELS.initializing_keys, status: 'idle' },
  };
}

function createBleReadinessChecker(): (() => Promise<PermissionCheckResult>) {
  return async () => {
    let manager: BleManagerLike | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bleModule = require('react-native-ble-plx');
      manager = new bleModule.BleManager() as BleManagerLike;
      const state = await manager.state();

      return mapBleStateToPermissionResult(state);
    } catch (error) {
      return mapBlePermissionFailure(error);
    } finally {
      manager?.destroy();
    }
  };
}

async function initializeIdentityKeypair(): Promise<PermissionCheckResult> {
  try {
    await getOrCreateIdentityKeypair();
    return { status: 'granted' };
  } catch (error) {
    return mapIdentityInitializationFailure(error);
  }
}

export function useOnboardingPermissions(ports: UseOnboardingPermissionsPorts = {}) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [steps, setSteps] = useState<StepStateMap>(createInitialSteps);

  const requestCamera = useCallback(async (): Promise<PermissionCheckResult> => {
    const currentPermission = ports.camera?.currentPermission ?? cameraPermission;

    if (currentPermission?.granted) {
      return { status: 'granted' };
    }

    const response = await (ports.camera?.requestPermission ?? requestCameraPermission)();

    if (response.granted) {
      return { status: 'granted' };
    }

    if (response.canAskAgain === false) {
      return {
        status: 'blocked',
        errorMessage: 'camera_permission_blocked',
      };
    }

    return {
      status: 'denied',
      errorMessage: 'Camera permission denied by the OS.',
    };
  }, [cameraPermission, ports.camera, requestCameraPermission]);

  const checkBluetoothReadiness = useMemo(
    () => ports.bluetooth?.checkReadiness ?? createBleReadinessChecker(),
    [ports.bluetooth?.checkReadiness]
  );

  const checkSecureStoreReadiness = useMemo(
    () => ports.secureStore?.checkReadiness ?? probeSecureStoreReadiness,
    [ports.secureStore?.checkReadiness]
  );

  const runIdentityInitialization = useMemo(
    () => ports.identity?.initializeKeypair ?? initializeIdentityKeypair,
    [ports.identity?.initializeKeypair]
  );

  const runStep = useCallback(async (key: OnboardingPermissionStepKey): Promise<PermissionCheckResult> => {
    setSteps((previous) => ({
      ...previous,
      [key]: { ...previous[key], status: 'requesting', errorMessage: undefined },
    }));

    let result: PermissionCheckResult;
    if (key === 'camera') {
      result = await requestCamera();
    } else if (key === 'bluetooth') {
      result = await checkBluetoothReadiness();
    } else if (key === 'secureStore') {
      result = await checkSecureStoreReadiness();
    } else {
      result = await runIdentityInitialization();
    }

    const normalizedErrorMessage =
      key === 'initializing_keys'
        ? result.errorMessage
        : normalizePermissionErrorMessage(
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
  }, [checkBluetoothReadiness, checkSecureStoreReadiness, requestCamera, runIdentityInitialization]);

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
    : steps.initializing_keys.status === 'denied' || steps.initializing_keys.status === 'blocked'
      ? 'blocked_by_key_init_failure'
      : steps.camera.status === 'denied' ||
          steps.camera.status === 'blocked' ||
          steps.bluetooth.status === 'denied' ||
          steps.bluetooth.status === 'blocked' ||
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
