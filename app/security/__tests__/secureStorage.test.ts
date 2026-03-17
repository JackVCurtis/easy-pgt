import { createInMemorySecureStoreAdapter, createSecureValueStore } from '@/app/security/secureStorage';

describe('secureStorage value recovery', () => {
  it('maps authenticated read failures to invalidated result and clears unreadable value', async () => {
    const adapter = createInMemorySecureStoreAdapter({ 'test.secret': 'top-secret' });
    const store = createSecureValueStore({
      adapter: {
        ...adapter,
        getItem: jest.fn(async () => {
          throw new Error('Key permanently invalidated after biometric enrollment changed');
        }),
      },
    });

    await expect(store.readValue('test.secret', 'authenticated-secure-store')).resolves.toEqual({
      status: 'invalidated',
      value: null,
      message: 'Protected secure storage was invalidated. Re-run onboarding to restore this data.',
    });

    await expect(adapter.getItem('test.secret')).resolves.toBeNull();
  });
});
