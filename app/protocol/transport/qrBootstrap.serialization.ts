import { canonicalSerialize } from '../validation/crypto/signingPayload';

import type { SignableQrBootstrapV1 } from './qrBootstrap.types';

export function canonicalSerializeQrBootstrap(payload: SignableQrBootstrapV1): Uint8Array {
  return canonicalSerialize(payload as unknown as Record<string, unknown>);
}
