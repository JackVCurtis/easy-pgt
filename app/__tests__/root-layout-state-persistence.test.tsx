import type React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockPersistSecureAppState = jest.fn<Promise<void>, []>();
const mockUnlockGate = jest.fn<Promise<{ status: 'unlocked' | 'locked' }>, []>();
const mockIsUnlockInProgress = jest.fn<boolean, []>();
const mockReplace = jest.fn();
const mockUsePathname = jest.fn<string, []>();

let changeHandler: ((nextState: string) => void) | undefined;
let blurHandler: (() => void) | undefined;

const mockRemoveChangeListener = jest.fn();
const mockRemoveBlurListener = jest.fn();

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((eventType: string, handler: (nextState: string) => void) => {
      if (eventType === 'change') {
        changeHandler = handler;
        return { remove: mockRemoveChangeListener };
      }

      blurHandler = handler as () => void;
      return { remove: mockRemoveBlurListener };
    }),
  },
}));

jest.mock('@/app/state/secureStatePersistence', () => ({
  persistSecureAppState: () => mockPersistSecureAppState(),
}));

jest.mock('@/app/security/unlockGate', () => ({
  unlockGate: () => mockUnlockGate(),
  isUnlockInProgress: () => mockIsUnlockInProgress(),
}));

jest.mock('@react-navigation/native', () => ({
  DarkTheme: {},
  DefaultTheme: {},
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const StackComponent = ({ children }: { children: React.ReactNode }) => children;
  (StackComponent as unknown as { Screen: unknown }).Screen = () => null;

  return {
    Stack: StackComponent,
    useRouter: () => ({
      replace: mockReplace,
    }),
    usePathname: () => mockUsePathname(),
  };
});

jest.mock('react-native-reanimated', () => ({}));
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

describe('root layout secure state persistence lifecycle', () => {
  let RootLayout: () => React.ReactElement;

  beforeEach(() => {
    jest.clearAllMocks();
    changeHandler = undefined;
    blurHandler = undefined;

    mockPersistSecureAppState.mockResolvedValue();
    mockUnlockGate.mockResolvedValue({ status: 'unlocked' });
    mockIsUnlockInProgress.mockReturnValue(false);
    mockUsePathname.mockReturnValue('/');

    RootLayout = require('@/app/_layout').default as () => React.ReactElement;
  });

  it('flushes encrypted state when app transitions to inactive/background and on blur lock-equivalent events', async () => {
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(<RootLayout />);
    });

    await act(async () => {
      changeHandler?.('active');
      changeHandler?.('inactive');
      changeHandler?.('background');
      blurHandler?.();
    });

    expect(mockPersistSecureAppState).toHaveBeenCalledTimes(3);

    await act(async () => {
      renderer.unmount();
    });

    expect(mockRemoveChangeListener).toHaveBeenCalledTimes(1);
    expect(mockRemoveBlurListener).toHaveBeenCalledTimes(1);
  });

  it('runs unlock gate on app resume and routes to lock screen when unlock fails', async () => {
    mockUnlockGate.mockResolvedValueOnce({ status: 'locked' });

    await act(async () => {
      create(<RootLayout />);
    });

    await act(async () => {
      changeHandler?.('background');
      changeHandler?.('active');
    });

    expect(mockUnlockGate).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/lock');
  });

  it('skips resume unlock checks while an unlock is already in progress', async () => {
    mockIsUnlockInProgress.mockReturnValue(true);

    await act(async () => {
      create(<RootLayout />);
    });

    await act(async () => {
      changeHandler?.('background');
      changeHandler?.('active');
    });

    expect(mockUnlockGate).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not rerun resume unlock checks while lock route is active', async () => {
    mockUsePathname.mockReturnValue('/lock');

    await act(async () => {
      create(<RootLayout />);
    });

    await act(async () => {
      changeHandler?.('background');
      changeHandler?.('active');
    });

    expect(mockUnlockGate).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
