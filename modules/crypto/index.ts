import { generateRandomBytes } from '@/modules/protocol/crypto/crypto';
import { encodeBase64 } from '@/modules/utils/bytes';

export * from './hashing';

const APP_SESSION_KEY_LENGTH_BYTES = 32;

export function generateSecureSessionKey(): string {
  return encodeBase64(generateRandomBytes(APP_SESSION_KEY_LENGTH_BYTES));
}
