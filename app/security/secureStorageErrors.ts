const INVALIDATION_KEYWORDS = [
  'invalidated',
  'key permanently invalidated',
  'unreadable and was cleared',
  'keystore operation failed',
];

const AUTHENTICATION_KEYWORDS = [
  'authentication',
  'authenticated',
  'not authenticated',
  'user canceled',
  'user cancelled',
  'cancel',
  'biometric',
  'passcode',
  'device locked',
  'interaction not allowed',
];

export type SecureStorageErrorClassification = {
  message: string;
  isInvalidated: boolean;
  isAuthenticationRelated: boolean;
};

function includesKeyword(message: string, keywords: string[]): boolean {
  return keywords.some((keyword) => message.includes(keyword));
}

export function classifySecureStorageError(error: unknown): SecureStorageErrorClassification {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  return {
    message,
    isInvalidated: includesKeyword(message, INVALIDATION_KEYWORDS),
    isAuthenticationRelated: includesKeyword(message, AUTHENTICATION_KEYWORDS),
  };
}
