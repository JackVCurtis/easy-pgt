import { unlockGate } from '@/app/security/unlockGate';

describe('unlockGate', () => {
  it('authenticates then hydrates state into memory when auth succeeds', async () => {
    const authenticate = jest.fn().mockResolvedValue({ status: 'success' as const });
    const hydrateState = jest.fn().mockResolvedValue();
    const unloadState = jest.fn();

    await expect(unlockGate({ authenticate, hydrateState, unloadState })).resolves.toEqual({
      status: 'unlocked',
    });

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(hydrateState).toHaveBeenCalledTimes(1);
    expect(unloadState).not.toHaveBeenCalled();
  });

  it('keeps state unloaded and returns locked when auth is canceled', async () => {
    const authenticate = jest.fn().mockResolvedValue({ status: 'canceled' as const });
    const hydrateState = jest.fn();
    const unloadState = jest.fn();

    await expect(unlockGate({ authenticate, hydrateState, unloadState })).resolves.toEqual({
      status: 'locked',
      reason: 'auth_canceled',
    });

    expect(hydrateState).not.toHaveBeenCalled();
    expect(unloadState).toHaveBeenCalledTimes(1);
  });

  it('keeps state unloaded and returns locked when hydration fails after auth', async () => {
    const authenticate = jest.fn().mockResolvedValue({ status: 'success' as const });
    const hydrateState = jest.fn().mockRejectedValue(new Error('decrypt failure'));
    const unloadState = jest.fn();

    await expect(unlockGate({ authenticate, hydrateState, unloadState })).resolves.toEqual({
      status: 'locked',
      reason: 'hydrate_failed',
    });

    expect(unloadState).toHaveBeenCalledTimes(1);
  });
});
