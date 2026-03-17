import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';

import {
  mapBlePermissionFailure,
  mapBleStateToPermissionResult,
  type OnboardingPermissionStatus,
  type PermissionCheckResult,
} from '@/app/onboarding/bluetoothPermission';
import { probeSecureStoreReadiness } from '@/app/onboarding/secureStoreReadiness';

export type OnboardingPermissionStepKey = 'camera' | 'bluetooth' | 'secureStore';

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
}

const STEP_ORDER: OnboardingPermissionStepKey[] = ['camera', 'bluetooth', 'secureStore'];

const STEP_LABELS: Record<OnboardingPermissionStepKey, string> = {
  camera: 'Camera',
  bluetooth: 'Bluetooth',
  secureStore: 'Secure key storage',
};

function createInitialSteps(): StepStateMap {
  return {
    camera: { label: STEP_LABELS.camera, status: 'idle' },
    bluetooth: { label: STEP_LABELS.bluetooth, status: 'idle' },
    secureStore: { label: STEP_LABELS.secureStore, status: 'idle' },
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
        errorMessage: 'Camera permission is blocked. Enable camera access in system settings.',
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

  const runStep = useCallback(async (key: OnboardingPermissionStepKey): Promise<void> => {
    setSteps((previous) => ({
      ...previous,
      [key]: { ...previous[key], status: 'requesting', errorMessage: undefined },
    }));

    let result: PermissionCheckResult;
    if (key === 'camera') {
      result = await requestCamera();
    } else if (key === 'bluetooth') {
      result = await checkBluetoothReadiness();
    } else {
      result = await checkSecureStoreReadiness();
    }

    setSteps((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        status: result.status,
        errorMessage: result.errorMessage,
      },
    }));
  }, [checkBluetoothReadiness, checkSecureStoreReadiness, requestCamera]);

  const runChecksFromStep = useCallback(async (startKey: OnboardingPermissionStepKey): Promise<void> => {
    const startIndex = STEP_ORDER.indexOf(startKey);
    const stepsToRun = STEP_ORDER.slice(startIndex);

    for (const key of stepsToRun) {
      await runStep(key);
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

  return {
    steps,
    orderedSteps: STEP_ORDER.map((key) => ({ key, ...steps[key] })),
    grantedCount,
    totalCount,
    isReady: grantedCount === totalCount,
    retryStep,
  };
}
