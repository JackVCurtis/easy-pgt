import SettingsStorage from 'expo-settings-storage';

import { classifySecureStorageError } from './secureStorageErrors';

export type SecureStoreAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

export type DeviceAuthenticationPromptResult = {
  status: 'success' | 'canceled' | 'failed';
  message?: string;
};

export type SecureStorageAuthSession = {
  token: string;
  authenticatedAtMs: number;
  expiresAtMs: number;
};

export type AuthenticateForSecureStorageResult = {
  status: 'success' | 'canceled' | 'failed';
  session?: SecureStorageAuthSession;
  message?: string;
};

export const SECURE_STORAGE_INVALIDATED_ERROR_MESSAGE =
  'SECURE_STORAGE_AUTH_INVALIDATED: Protected key material became unreadable and was cleared';
export const SECURE_STORAGE_AUTH_SESSION_RETRYABLE_ERROR_MESSAGE =
  'SECURE_STORAGE_AUTH_SESSION_RETRYABLE: Secure-storage authentication session is missing or expired. Retry to authenticate again.';

const DEFAULT_SECURE_STORAGE_AUTH_SESSION_TTL_MS = 60_000;

let activeSecureStorageAuthSession: SecureStorageAuthSession | null = null;

export function createExpoSecureStoreAdapter(): SecureStoreAdapter {
  return {
    async getItem(key: string) {
      return SettingsStorage.getItem(key);
    },
    async setItem(key: string, value: string) {
      await SettingsStorage.setItem(key, value);
    },
    async deleteItem(key: string) {
      await SettingsStorage.deleteItem(key);
    },
  };
}

export async function requestDeviceAuthenticationPrompt(): Promise<DeviceAuthenticationPromptResult> {
  const moduleWithPrompt = SettingsStorage as typeof SettingsStorage & {
    authenticate?: () => Promise<DeviceAuthenticationPromptResult>;
  };

  if (typeof moduleWithPrompt.authenticate !== 'function') {
    return { status: 'success' };
  }

  return moduleWithPrompt.authenticate();
}

export function createSecureStorageAuthSession(options: {
  now?: () => number;
  ttlMs?: number;
} = {}): SecureStorageAuthSession {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_SECURE_STORAGE_AUTH_SESSION_TTL_MS;
  const authenticatedAtMs = now();

  return {
    token: `secure-auth-session-${authenticatedAtMs}-${Math.random().toString(36).slice(2)}`,
    authenticatedAtMs,
    expiresAtMs: authenticatedAtMs + ttlMs,
  };
}

export function isSecureStorageAuthSessionActive(
  session: SecureStorageAuthSession | null | undefined,
  now: () => number = Date.now
): session is SecureStorageAuthSession {
  return Boolean(session && session.expiresAtMs > now());
}

export function setActiveSecureStorageAuthSession(session: SecureStorageAuthSession): void {
  activeSecureStorageAuthSession = session;
}

export function clearActiveSecureStorageAuthSession(): void {
  activeSecureStorageAuthSession = null;
}

export function getActiveSecureStorageAuthSession(now: () => number = Date.now): SecureStorageAuthSession | null {
  if (!isSecureStorageAuthSessionActive(activeSecureStorageAuthSession, now)) {
    activeSecureStorageAuthSession = null;
    return null;
  }

  return activeSecureStorageAuthSession;
}

export async function authenticateForSecureStorage(options: {
  now?: () => number;
  ttlMs?: number;
  requestPrompt?: () => Promise<DeviceAuthenticationPromptResult>;
} = {}): Promise<AuthenticateForSecureStorageResult> {
  const now = options.now ?? Date.now;
  const activeSession = getActiveSecureStorageAuthSession(now);

  if (activeSession) {
    return {
      status: 'success',
      session: activeSession,
    };
  }

  const promptResult = await (options.requestPrompt ?? requestDeviceAuthenticationPrompt)();

  if (promptResult.status !== 'success') {
    return {
      status: promptResult.status,
      message: promptResult.message,
    };
  }

  const session = createSecureStorageAuthSession({ now, ttlMs: options.ttlMs });
  setActiveSecureStorageAuthSession(session);

  return {
    status: 'success',
    session,
  };
}

export function assertActiveSecureStorageAuthSession(
  session: SecureStorageAuthSession | null | undefined,
  now: () => number = Date.now
): SecureStorageAuthSession {
  if (!isSecureStorageAuthSessionActive(session, now)) {
    throw new Error(SECURE_STORAGE_AUTH_SESSION_RETRYABLE_ERROR_MESSAGE);
  }

  return session;
}

export function mapSecureStorageAuthErrorToRetryable(error: unknown): Error {
  const classification = classifySecureStorageError(error);

  if (classification.isAuthenticationRelated) {
    return new Error(SECURE_STORAGE_AUTH_SESSION_RETRYABLE_ERROR_MESSAGE);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

export function createInMemorySecureStoreAdapter(initialData: Record<string, string> = {}): SecureStoreAdapter {
  const store = new Map<string, string>(Object.entries(initialData));

  return {
    async getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async setItem(key: string, value: string) {
      store.set(key, value);
    },
    async deleteItem(key: string) {
      store.delete(key);
    },
  };
}

export async function readSecureStoreItemOrClearOnInvalidation(
  adapter: SecureStoreAdapter,
  key: string,
  invalidatedMessage = SECURE_STORAGE_INVALIDATED_ERROR_MESSAGE
): Promise<string | null> {
  try {
    return await adapter.getItem(key);
  } catch (error) {
    const classification = classifySecureStorageError(error);

    if (classification.isInvalidated) {
      await adapter.deleteItem(key);
      throw new Error(invalidatedMessage);
    }

    throw error;
  }
}
