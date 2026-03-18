import type React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockHasCompletedOnboarding = jest.fn<Promise<boolean>, []>();
const mockUnlockGate = jest.fn<Promise<{ status: 'unlocked' | 'locked' }>, []>();

jest.mock('expo-router', () => ({
  Redirect: 'Redirect',
}));

jest.mock('@/app/onboarding/onboardingState', () => ({
  hasCompletedOnboarding: () => mockHasCompletedOnboarding(),
}));

jest.mock('@/app/security/unlockGate', () => ({
  unlockGate: () => mockUnlockGate(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe('root route', () => {
  let RootIndex: () => React.ReactElement;

  beforeEach(() => {
    jest.clearAllMocks();
    RootIndex = require('@/app/index').default as () => React.ReactElement;
  });

  it('renders a loading placeholder while onboarding state is being read', async () => {
    const deferred = createDeferred<boolean>();
    mockHasCompletedOnboarding.mockReturnValueOnce(deferred.promise);

    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(<RootIndex />);
    });

    expect(renderer.root.findByProps({ testID: 'root-route-loading' })).toBeTruthy();
  });

  it('redirects first-run users to onboarding', async () => {
    mockHasCompletedOnboarding.mockResolvedValueOnce(false);

    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(<RootIndex />);
    });

    const redirect = renderer.root.findByType('Redirect');

    expect(redirect.props).toMatchObject({ href: '/onboarding' });
    expect(mockUnlockGate).not.toHaveBeenCalled();
  });

  it('redirects completed onboarding users to lock screen when gate unlock fails', async () => {
    mockHasCompletedOnboarding.mockResolvedValueOnce(true);
    mockUnlockGate.mockResolvedValueOnce({ status: 'locked' });

    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(<RootIndex />);
    });

    const redirect = renderer.root.findByType('Redirect');

    expect(mockUnlockGate).toHaveBeenCalledTimes(1);
    expect(redirect.props).toMatchObject({ href: '/lock' });
  });

  it('redirects completed onboarding users to handshake when gate unlock succeeds', async () => {
    mockHasCompletedOnboarding.mockResolvedValueOnce(true);
    mockUnlockGate.mockResolvedValueOnce({ status: 'unlocked' });

    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(<RootIndex />);
    });

    const redirect = renderer.root.findByType('Redirect');

    expect(mockUnlockGate).toHaveBeenCalledTimes(1);
    expect(redirect.props).toMatchObject({ href: '/handshake' });
  });
});
