import { generateRandomBytes } from '@/app/protocol/crypto/crypto';
import { encodeBase64 } from '@/app/utils/bytes';

export * from './hashing';

const APP_SESSION_KEY_LENGTH_BYTES = 32;

export function generateSecureSessionKey(): string {
  return encodeBase64(generateRandomBytes(APP_SESSION_KEY_LENGTH_BYTES));
}
