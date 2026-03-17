import type React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockHasCompletedOnboarding = jest.fn<Promise<boolean>, []>();

jest.mock('expo-router', () => ({
  Redirect: 'Redirect',
}));

jest.mock('@/app/onboarding/onboardingState', () => ({
  hasCompletedOnboarding: () => mockHasCompletedOnboarding(),
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
  });

  it('redirects completed onboarding users to handshake', async () => {
    mockHasCompletedOnboarding.mockResolvedValueOnce(true);

    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(<RootIndex />);
    });

    const redirect = renderer.root.findByType('Redirect');

    expect(redirect.props).toMatchObject({ href: '/handshake' });
  });
});
