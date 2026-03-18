import type React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockPersistSecureAppState = jest.fn<Promise<void>, []>();

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
});
