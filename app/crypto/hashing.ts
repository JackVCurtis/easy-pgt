import { computeLeafHashAsync, computeRecordHashAsync } from '@/app/protocol/crypto/hash';

/**
 * @deprecated Protocol hashing must come from `app/protocol/crypto/hash.ts`.
 * This module is a compatibility re-export for non-protocol/UI callers.
 */
export const computeRecordHash = computeRecordHashAsync;

/**
 * @deprecated Protocol hashing must come from `app/protocol/crypto/hash.ts`.
 * This module is a compatibility re-export for non-protocol/UI callers.
 */
export const computeLeafHash = computeLeafHashAsync;
