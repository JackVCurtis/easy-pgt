import { fireEvent, render, waitFor } from '@testing-library/react-native';

import OnboardingScreen from '@/app/onboarding';

const mockReplace = jest.fn();
const mockMarkOnboardingCompleted = jest.fn(async () => undefined);
const mockUseOnboardingPermissions = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('@/app/onboarding/onboardingState', () => ({
  markOnboardingCompleted: () => mockMarkOnboardingCompleted(),
}));

jest.mock('@/app/onboarding/useOnboardingPermissions', () => ({
  useOnboardingPermissions: () => mockUseOnboardingPermissions(),
}));

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders checklist progress, timeline, and retry action for failed initialization', () => {
    const retryStep = jest.fn(async () => undefined);

    mockUseOnboardingPermissions.mockReturnValue({
      grantedCount: 2,
      totalCount: 4,
      isReady: false,
      terminalState: 'blocked_by_key_init_failure',
      orderedSteps: [
        { key: 'camera', label: 'Camera', status: 'granted', errorMessage: undefined },
        { key: 'bluetooth', label: 'Bluetooth', status: 'granted', errorMessage: undefined },
        { key: 'secureStore', label: 'Secure key storage', status: 'granted', errorMessage: undefined },
        {
          key: 'initializing_keys',
          label: 'Initializing keys',
          status: 'blocked',
          errorMessage: 'Stored keypair appears corrupted. Retry initialization.',
        },
      ],
      retryStep,
      steps: {
        camera: { label: 'Camera', status: 'granted', errorMessage: undefined },
        bluetooth: { label: 'Bluetooth', status: 'granted', errorMessage: undefined },
        secureStore: { label: 'Secure key storage', status: 'granted', errorMessage: undefined },
        initializing_keys: {
          label: 'Initializing keys',
          status: 'blocked',
          errorMessage: 'Stored keypair appears corrupted. Retry initialization.',
        },
      },
    });

    const { getByText, getByRole } = render(<OnboardingScreen />);

    expect(getByText('Permissions ready: 2/4')).toBeTruthy();
    expect(getByText('Requesting permissions: Completed')).toBeTruthy();
    expect(getByText('Preparing secure storage: Completed')).toBeTruthy();
    expect(getByText('Generating identity keypair: Failed')).toBeTruthy();
    expect(getByText('Verifying stored keypair: Failed')).toBeTruthy();
    expect(getByText('Stored keypair appears corrupted. Retry initialization.')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: 'Retry initialization' }));

    expect(retryStep).toHaveBeenCalledWith('initializing_keys');
  });


  it('does not render a skip action for hard security requirements', () => {
    mockUseOnboardingPermissions.mockReturnValue({
      grantedCount: 1,
      totalCount: 4,
      isReady: false,
      terminalState: 'blocked_by_permissions',
      orderedSteps: [
        { key: 'camera', label: 'Camera', status: 'blocked', errorMessage: 'Camera access is required for secure QR verification. Open Settings > Comrades > Camera and enable access.' },
        { key: 'bluetooth', label: 'Bluetooth', status: 'idle', errorMessage: undefined },
        { key: 'secureStore', label: 'Secure key storage', status: 'idle', errorMessage: undefined },
        { key: 'initializing_keys', label: 'Initializing keys', status: 'idle', errorMessage: undefined },
      ],
      retryStep: jest.fn(async () => undefined),
      steps: {
        camera: { label: 'Camera', status: 'blocked', errorMessage: 'Camera access is required for secure QR verification. Open Settings > Comrades > Camera and enable access.' },
        bluetooth: { label: 'Bluetooth', status: 'idle', errorMessage: undefined },
        secureStore: { label: 'Secure key storage', status: 'idle', errorMessage: undefined },
        initializing_keys: { label: 'Initializing keys', status: 'idle', errorMessage: undefined },
      },
    });

    const { queryByRole, getByText } = render(<OnboardingScreen />);

    expect(getByText('Security status: blocked_by_permissions')).toBeTruthy();
    expect(queryByRole('button', { name: /skip/i })).toBeNull();
  });

  it('continues to handshake only after all permissions are granted', async () => {
    mockUseOnboardingPermissions.mockReturnValue({
      grantedCount: 4,
      totalCount: 4,
      isReady: true,
      terminalState: 'ready_to_continue',
      orderedSteps: [
        { key: 'camera', label: 'Camera', status: 'granted', errorMessage: undefined },
        { key: 'bluetooth', label: 'Bluetooth', status: 'granted', errorMessage: undefined },
        { key: 'secureStore', label: 'Secure key storage', status: 'granted', errorMessage: undefined },
        { key: 'initializing_keys', label: 'Initializing keys', status: 'granted', errorMessage: undefined },
      ],
      retryStep: jest.fn(async () => undefined),
      steps: {
        camera: { label: 'Camera', status: 'granted', errorMessage: undefined },
        bluetooth: { label: 'Bluetooth', status: 'granted', errorMessage: undefined },
        secureStore: { label: 'Secure key storage', status: 'granted', errorMessage: undefined },
        initializing_keys: { label: 'Initializing keys', status: 'granted', errorMessage: undefined },
      },
    });

    const { getByRole } = render(<OnboardingScreen />);

    fireEvent.press(getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mockMarkOnboardingCompleted).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/handshake');
    });
  });
});
