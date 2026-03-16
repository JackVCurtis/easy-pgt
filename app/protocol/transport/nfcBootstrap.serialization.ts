import { canonicalSerialize } from '../validation/crypto/signingPayload';

import type { SignableNfcBootstrapV1 } from './nfcBootstrap.types';

export function canonicalSerializeNfcBootstrap(payload: SignableNfcBootstrapV1): Uint8Array {
  return canonicalSerialize(payload as unknown as Record<string, unknown>);
}
