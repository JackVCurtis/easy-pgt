import nacl from 'tweetnacl';

import { validateRecord } from '@/app/protocol/validation/validateRecord';
import { deriveSigningPayloadBytes } from '@/app/protocol/validation/crypto/signingPayload';

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function signRecordPayload(record: Record<string, unknown>, secretKey: Uint8Array): string {
  const payloadBytes = deriveSigningPayloadBytes(record);
  return toBase64(nacl.sign.detached(payloadBytes, secretKey));
}

describe('validateRecord cryptographic checks', () => {
  const identityA = nacl.sign.keyPair();
  const identityB = nacl.sign.keyPair();
  const identityC = nacl.sign.keyPair();

  const keyByBindingHash: Record<string, string> = {
    hash_binding_a: toBase64(identityA.publicKey),
    hash_binding_b: toBase64(identityB.publicKey),
    hash_endorser_binding: toBase64(identityA.publicKey),
    hash_subject_binding: toBase64(identityB.publicKey),
    hash_old_binding: toBase64(identityA.publicKey),
    hash_new_binding: toBase64(identityB.publicKey),
    hash_signer_binding: toBase64(identityA.publicKey),
  };

  const context = {
    resolvePublicKeyByBindingHash(bindingHash: string) {
      return keyByBindingHash[bindingHash];
    },
  };

  const validIdentityBinding = {
    record_type: 'identity_binding' as const,
    record_version: 1,
    subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    subject_identity_public_key: toBase64(identityA.publicKey),
    key_epoch: 1,
    created_at: '2026-03-15T10:00:00.000Z',
    self_signature: '',
  };

  validIdentityBinding.self_signature = signRecordPayload(validIdentityBinding, identityA.secretKey);

  const validHandshake = {
    record_type: 'handshake' as const,
    record_version: 1,
    handshake_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
    participant_a_binding_hash: 'hash_binding_a',
    participant_b_binding_hash: 'hash_binding_b',
    participant_a_merkle_root: 'hash_a123',
    participant_b_merkle_root: 'hash_b123',
    ephemeral_keys: {
      participant_a: toBase64(identityA.publicKey),
      participant_b: toBase64(identityB.publicKey),
    },
    signatures: {
      participant_a: '',
      participant_b: '',
    },
  };

  validHandshake.signatures.participant_a = signRecordPayload(validHandshake, identityA.secretKey);
  validHandshake.signatures.participant_b = signRecordPayload(validHandshake, identityB.secretKey);

  const validEndorsement = {
    record_type: 'endorsement' as const,
    record_version: 1,
    endorser_binding_hash: 'hash_endorser_binding',
    subject_binding_hash: 'hash_subject_binding',
    endorsement_type: 'binding_valid' as const,
    confidence_level: 'high' as const,
    signature: '',
  };

  validEndorsement.signature = signRecordPayload(validEndorsement, identityA.secretKey);

  const validKeyRotation = {
    record_type: 'key_rotation' as const,
    record_version: 1,
    subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    old_binding_hash: 'hash_old_binding',
    new_binding_hash: 'hash_new_binding',
    rotation_counter: 2,
    signatures: {
      old_key: '',
      new_key: '',
    },
  };

  validKeyRotation.signatures.old_key = signRecordPayload(validKeyRotation, identityA.secretKey);
  validKeyRotation.signatures.new_key = signRecordPayload(validKeyRotation, identityB.secretKey);

  const validRevocation = {
    record_type: 'revocation' as const,
    record_version: 1,
    signer_binding_hash: 'hash_signer_binding',
    target_record_hash: 'hash_target_record',
    reason_code: 'other' as const,
    signature: '',
  };

  validRevocation.signature = signRecordPayload(validRevocation, identityA.secretKey);

  it('accepts a valid identity_binding self-signature and rejects tampered payloads', () => {
    expect(validateRecord(validIdentityBinding, context)).toEqual({ accepted: true });

    const tampered = { ...validIdentityBinding, key_epoch: 999 };
    expect(validateRecord(tampered, context)).toMatchObject({
      accepted: false,
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'self_signature',
    });
  });

  it('accepts handshake signatures and rejects missing, invalid, and wrong-key signatures', () => {
    expect(validateRecord(validHandshake, context)).toEqual({ accepted: true });

    const missingSig = {
      ...validHandshake,
      signatures: { ...validHandshake.signatures, participant_b: 'YQ==' },
    };
    expect(validateRecord(missingSig, context)).toMatchObject({
      accepted: false,
      phase: 'cryptographic',
      reason: 'signature_decode_failed',
      field: 'signatures.participant_b',
    });

    const invalidSig = {
      ...validHandshake,
      signatures: { ...validHandshake.signatures, participant_b: toBase64(nacl.randomBytes(64)) },
    };
    expect(validateRecord(invalidSig, context)).toMatchObject({
      accepted: false,
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signatures.participant_b',
    });

    const wrongSigner = {
      ...validHandshake,
      signatures: {
        participant_a: signRecordPayload(validHandshake, identityC.secretKey),
        participant_b: validHandshake.signatures.participant_b,
      },
    };
    expect(validateRecord(wrongSigner, context)).toMatchObject({
      accepted: false,
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signatures.participant_a',
    });
  });

  it('accepts and rejects endorsement signatures based on payload and signer key', () => {
    expect(validateRecord(validEndorsement, context)).toEqual({ accepted: true });

    const tampered = { ...validEndorsement, confidence_level: 'low' as const };
    expect(validateRecord(tampered, context)).toMatchObject({
      accepted: false,
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signature',
    });

    const wrongSignerContext = {
      resolvePublicKeyByBindingHash(bindingHash: string) {
        if (bindingHash === 'hash_endorser_binding') {
          return toBase64(identityC.publicKey);
        }
        return keyByBindingHash[bindingHash];
      },
    };

    expect(validateRecord(validEndorsement, wrongSignerContext)).toMatchObject({
      accepted: false,
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signature',
    });
  });

  it('accepts key_rotation and revocation signer checks and rejects unauthorized signers', () => {
    expect(validateRecord(validKeyRotation, context)).toEqual({ accepted: true });
    expect(validateRecord(validRevocation, context)).toEqual({ accepted: true });

    const unauthorizedContext = {
      resolvePublicKeyByBindingHash(bindingHash: string) {
        if (bindingHash === 'hash_new_binding' || bindingHash === 'hash_signer_binding') {
          return toBase64(identityC.publicKey);
        }
        return keyByBindingHash[bindingHash];
      },
    };

    expect(validateRecord(validKeyRotation, unauthorizedContext)).toMatchObject({
      accepted: false,
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signatures.new_key',
    });
    expect(validateRecord(validRevocation, unauthorizedContext)).toMatchObject({
      accepted: false,
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signature',
    });
  });

  it('returns stable errors for malformed signature material and deterministic results', () => {
    const malformed = { ...validIdentityBinding, self_signature: '!bad*signature!' };
    const resultA = validateRecord(malformed, context);
    const resultB = validateRecord(malformed, context);

    expect(resultA).toEqual({
      accepted: false,
      phase: 'cryptographic',
      reason: 'signature_decode_failed',
      field: 'self_signature',
    });
    expect(resultA).toEqual(resultB);
  });
});
