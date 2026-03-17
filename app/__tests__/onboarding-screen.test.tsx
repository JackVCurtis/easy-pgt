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

  it('renders checklist progress and retry buttons for blocked/denied steps', () => {
    mockUseOnboardingPermissions.mockReturnValue({
      grantedCount: 1,
      totalCount: 3,
      isReady: false,
      orderedSteps: [
        { key: 'camera', label: 'Camera', status: 'granted', errorMessage: undefined },
        { key: 'bluetooth', label: 'Bluetooth', status: 'denied', errorMessage: 'Bluetooth permission denied by the OS.' },
        { key: 'secureStore', label: 'Secure key storage', status: 'blocked', errorMessage: 'Secure key storage is unavailable.' },
      ],
      retryStep: jest.fn(async () => undefined),
    });

    const { getByText, getByRole } = render(<OnboardingScreen />);

    expect(getByText('Permissions ready: 1/3')).toBeTruthy();
    expect(getByText('Bluetooth permission denied by the OS.')).toBeTruthy();
    expect(getByText('Secure key storage is unavailable.')).toBeTruthy();
    expect(getByRole('button', { name: 'Retry Bluetooth' })).toBeTruthy();
    expect(getByRole('button', { name: 'Retry Secure key storage' })).toBeTruthy();
  });

  it('continues to handshake only after all permissions are granted', async () => {
    mockUseOnboardingPermissions.mockReturnValue({
      grantedCount: 3,
      totalCount: 3,
      isReady: true,
      orderedSteps: [
        { key: 'camera', label: 'Camera', status: 'granted', errorMessage: undefined },
        { key: 'bluetooth', label: 'Bluetooth', status: 'granted', errorMessage: undefined },
        { key: 'secureStore', label: 'Secure key storage', status: 'granted', errorMessage: undefined },
      ],
      retryStep: jest.fn(async () => undefined),
    });

    const { getByRole } = render(<OnboardingScreen />);

    fireEvent.press(getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mockMarkOnboardingCompleted).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/handshake');
    });
  });
});
