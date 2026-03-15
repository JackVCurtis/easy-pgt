import nacl from 'tweetnacl';

import type { DurableRecord } from '../records';
import { deriveSigningPayloadBytes } from './crypto/signingPayload';
import { decodePublicKey, decodeSignature } from './crypto/signatureDecoding';

export type CryptographicValidationErrorCode =
  | 'signature_decode_failed'
  | 'public_key_decode_failed'
  | 'signer_key_not_found'
  | 'invalid_signature'
  | 'unsupported_record_type';

export type CryptographicValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason: CryptographicValidationErrorCode;
      field: string;
    };

export type CryptographicValidationContext = {
  resolvePublicKeyByBindingHash?: (bindingHash: string) => string | undefined;
};

function invalid(reason: CryptographicValidationErrorCode, field: string): CryptographicValidationResult {
  return { valid: false, reason, field };
}

function verifyDetachedSignature(
  payloadBytes: Uint8Array,
  signature: string,
  publicKey: string,
  field: string
): CryptographicValidationResult {
  const decodedSignature = decodeSignature(signature);
  if (!decodedSignature) {
    return invalid('signature_decode_failed', field);
  }

  const decodedPublicKey = decodePublicKey(publicKey);
  if (!decodedPublicKey) {
    return invalid('public_key_decode_failed', field);
  }

  return nacl.sign.detached.verify(payloadBytes, decodedSignature, decodedPublicKey)
    ? { valid: true }
    : invalid('invalid_signature', field);
}

function resolveSignerKey(
  context: CryptographicValidationContext,
  bindingHash: string,
  field: string
): { valid: true; publicKey: string } | CryptographicValidationResult {
  const publicKey = context.resolvePublicKeyByBindingHash?.(bindingHash);
  if (!publicKey) {
    return invalid('signer_key_not_found', field);
  }

  return { valid: true, publicKey };
}

export function validateRecordCryptography(
  record: DurableRecord,
  context: CryptographicValidationContext = {}
): CryptographicValidationResult {
  const payloadBytes = deriveSigningPayloadBytes(record as unknown as Record<string, unknown>);

  switch (record.record_type) {
    case 'identity_binding':
      return verifyDetachedSignature(
        payloadBytes,
        record.self_signature,
        record.subject_identity_public_key,
        'self_signature'
      );
    case 'handshake': {
      const participantA = resolveSignerKey(context, record.participant_a_binding_hash, 'participant_a_binding_hash');
      if (!participantA.valid) {
        return participantA;
      }

      const participantB = resolveSignerKey(context, record.participant_b_binding_hash, 'participant_b_binding_hash');
      if (!participantB.valid) {
        return participantB;
      }

      const participantAResult = verifyDetachedSignature(
        payloadBytes,
        record.signatures.participant_a,
        participantA.publicKey,
        'signatures.participant_a'
      );
      if (!participantAResult.valid) {
        return participantAResult;
      }

      return verifyDetachedSignature(
        payloadBytes,
        record.signatures.participant_b,
        participantB.publicKey,
        'signatures.participant_b'
      );
    }
    case 'endorsement': {
      const signer = resolveSignerKey(context, record.endorser_binding_hash, 'endorser_binding_hash');
      if (!signer.valid) {
        return signer;
      }

      return verifyDetachedSignature(payloadBytes, record.signature, signer.publicKey, 'signature');
    }
    case 'key_rotation': {
      const oldSigner = resolveSignerKey(context, record.old_binding_hash, 'old_binding_hash');
      if (!oldSigner.valid) {
        return oldSigner;
      }

      const newSigner = resolveSignerKey(context, record.new_binding_hash, 'new_binding_hash');
      if (!newSigner.valid) {
        return newSigner;
      }

      const oldSignatureResult = verifyDetachedSignature(
        payloadBytes,
        record.signatures.old_key,
        oldSigner.publicKey,
        'signatures.old_key'
      );
      if (!oldSignatureResult.valid) {
        return oldSignatureResult;
      }

      return verifyDetachedSignature(payloadBytes, record.signatures.new_key, newSigner.publicKey, 'signatures.new_key');
    }
    case 'revocation': {
      const signer = resolveSignerKey(context, record.signer_binding_hash, 'signer_binding_hash');
      if (!signer.valid) {
        return signer;
      }

      return verifyDetachedSignature(payloadBytes, record.signature, signer.publicKey, 'signature');
    }
  }

  const unreachableRecordType = (record as DurableRecord & { record_type: string }).record_type;
  return invalid('unsupported_record_type', `record_type:${unreachableRecordType}`);
}

