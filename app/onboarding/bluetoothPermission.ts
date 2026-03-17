export type OnboardingPermissionStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'blocked';

export interface PermissionCheckResult {
  status: Exclude<OnboardingPermissionStatus, 'idle' | 'requesting'>;
  errorMessage?: string;
}

export function mapBleStateToPermissionResult(state: string): PermissionCheckResult {
  switch (state) {
    case 'PoweredOn':
      return { status: 'granted' };
    case 'Unauthorized':
      return {
        status: 'denied',
        errorMessage: 'Bluetooth permission denied by the OS.',
      };
    case 'Unsupported':
      return {
        status: 'blocked',
        errorMessage: 'Bluetooth is unsupported on this device.',
      };
    case 'PoweredOff':
      return {
        status: 'blocked',
        errorMessage: 'Bluetooth is turned off. Enable Bluetooth and retry.',
      };
    default:
      return {
        status: 'blocked',
        errorMessage: 'Bluetooth is not ready yet. Please retry.',
      };
  }
}

export function mapBlePermissionFailure(error: unknown): PermissionCheckResult {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (message.includes('permission') || message.includes('unauthorized')) {
    return {
      status: 'denied',
      errorMessage: 'Bluetooth permission denied by the OS.',
    };
  }

  if (message.includes('unsupported') || message.includes('unavailable')) {
    return {
      status: 'blocked',
      errorMessage: 'Bluetooth is unavailable on this device.',
    };
  }

  return {
    status: 'blocked',
    errorMessage: 'Bluetooth readiness check failed. Please retry.',
  };
}
