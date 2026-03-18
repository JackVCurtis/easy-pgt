import {
  createExpoSecureStoreAdapter,
  createInMemorySecureStoreAdapter,
  type SecureStoreAdapter,
} from './secureStorageContract';
import { classifySecureStorageError } from './secureStorageErrors';

export { createExpoSecureStoreAdapter, createInMemorySecureStoreAdapter, type SecureStoreAdapter };

export type SecureReadResult = {
  status: 'ok' | 'invalidated';
  value: string | null;
  message?: string;
};

export function createSecureValueStore(options: { adapter?: SecureStoreAdapter } = {}) {
  const adapter = options.adapter ?? createExpoSecureStoreAdapter();

  return {
    async readValue(key: string): Promise<SecureReadResult> {
      try {
        const value = await adapter.getItem(key);
        return { status: 'ok', value };
      } catch (error) {
        const classification = classifySecureStorageError(error);

        if (classification.isInvalidated || classification.isAuthenticationRelated) {
          await adapter.deleteItem(key);
          return {
            status: 'invalidated',
            value: null,
            message: 'Protected secure storage was invalidated. Re-run onboarding to restore this data.',
          };
        }

        throw error;
      }
    },
  };
}
