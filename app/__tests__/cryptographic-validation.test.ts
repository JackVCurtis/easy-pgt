import { validateRecord } from '@/app/protocol/validation/validateRecord';
import { generateIdentityKeypair, signRecord } from '@/app/protocol/crypto/crypto';

function malformedLengthSignature(): string {
  return 'YQ==';
}

describe('validateRecord cryptographic checks', () => {
  const identityA = generateIdentityKeypair({
    seed: Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1)),
  });
  const identityB = generateIdentityKeypair({
    seed: Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 33)),
  });
  const identityC = generateIdentityKeypair({
    seed: Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 65)),
  });

  const keyByBindingHash: Record<string, string> = {
    hash_binding_a: identityA.publicKey,
    hash_binding_b: identityB.publicKey,
    hash_endorser_binding: identityA.publicKey,
    hash_subject_binding: identityB.publicKey,
    hash_old_binding: identityA.publicKey,
    hash_new_binding: identityB.publicKey,
    hash_signer_binding: identityA.publicKey,
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
    subject_identity_public_key: identityA.publicKey,
    key_epoch: 1,
    created_at: '2026-03-15T10:00:00.000Z',
    self_signature: '',
  };

  validIdentityBinding.self_signature = signRecord(validIdentityBinding, identityA.secretKey);

  const validHandshake = {
    record_type: 'handshake' as const,
    record_version: 1,
    handshake_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
    participant_a_binding_hash: 'hash_binding_a',
    participant_b_binding_hash: 'hash_binding_b',
    participant_a_merkle_root: 'hash_a123',
    participant_b_merkle_root: 'hash_b123',
    ephemeral_keys: {
      participant_a: identityA.publicKey,
      participant_b: identityB.publicKey,
    },
    signatures: {
      participant_a: '',
      participant_b: '',
    },
  };

  validHandshake.signatures.participant_a = signRecord(validHandshake, identityA.secretKey);
  validHandshake.signatures.participant_b = signRecord(validHandshake, identityB.secretKey);

  const validEndorsement = {
    record_type: 'endorsement' as const,
    record_version: 1,
    endorser_binding_hash: 'hash_endorser_binding',
    subject_binding_hash: 'hash_subject_binding',
    endorsement_type: 'binding_valid' as const,
    signature: '',
  };

  validEndorsement.signature = signRecord(validEndorsement, identityA.secretKey);

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

  validKeyRotation.signatures.old_key = signRecord(validKeyRotation, identityA.secretKey);
  validKeyRotation.signatures.new_key = signRecord(validKeyRotation, identityB.secretKey);

  const validRevocation = {
    record_type: 'revocation' as const,
    record_version: 1,
    signer_binding_hash: 'hash_signer_binding',
    target_record_hash: 'hash_target_record',
    reason_code: 'other' as const,
    signature: '',
  };

  validRevocation.signature = signRecord(validRevocation, identityA.secretKey);

  it('accepts a valid identity_binding self-signature and rejects tampered payloads', () => {
    expect(validateRecord(validIdentityBinding, context)).toEqual({
      status: 'accepted',
      reason: 'validation_passed',
      details: {
        source: 'record_validation',
      },
    });

    const tampered = { ...validIdentityBinding, key_epoch: 999 };
    expect(validateRecord(tampered, context)).toMatchObject({
      status: 'rejected',
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'self_signature',
    });
  });

  it('accepts handshake signatures and rejects missing, invalid, and wrong-key signatures', () => {
    expect(validateRecord(validHandshake, context)).toEqual({
      status: 'accepted',
      reason: 'validation_passed',
      details: {
        source: 'record_validation',
      },
    });

    const missingSig = {
      ...validHandshake,
      signatures: { ...validHandshake.signatures, participant_b: malformedLengthSignature() },
    };
    expect(validateRecord(missingSig, context)).toMatchObject({
      status: 'rejected',
      phase: 'cryptographic',
      reason: 'signature_decode_failed',
      field: 'signatures.participant_b',
    });

    const invalidSig = {
      ...validHandshake,
      signatures: { ...validHandshake.signatures, participant_b: signRecord(validHandshake, identityC.secretKey) },
    };
    expect(validateRecord(invalidSig, context)).toMatchObject({
      status: 'rejected',
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signatures.participant_b',
    });

    const wrongSigner = {
      ...validHandshake,
      signatures: {
        participant_a: signRecord(validHandshake, identityC.secretKey),
        participant_b: validHandshake.signatures.participant_b,
      },
    };
    expect(validateRecord(wrongSigner, context)).toMatchObject({
      status: 'rejected',
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signatures.participant_a',
    });
  });

  it('accepts and rejects endorsement signatures based on payload and signer key', () => {
    expect(validateRecord(validEndorsement, context)).toEqual({
      status: 'accepted',
      reason: 'validation_passed',
      details: {
        source: 'record_validation',
      },
    });

    const tampered = { ...validEndorsement, endorsement_type: 'binding_invalid' as const };
    expect(validateRecord(tampered, context)).toMatchObject({
      status: 'rejected',
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signature',
    });

    const wrongSignerContext = {
      resolvePublicKeyByBindingHash(bindingHash: string) {
        if (bindingHash === 'hash_endorser_binding') {
          return identityC.publicKey;
        }
        return keyByBindingHash[bindingHash];
      },
    };

    expect(validateRecord(validEndorsement, wrongSignerContext)).toMatchObject({
      status: 'rejected',
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signature',
    });
  });

  it('accepts key_rotation and revocation signer checks and rejects unauthorized signers', () => {
    expect(validateRecord(validKeyRotation, context)).toEqual({
      status: 'accepted',
      reason: 'validation_passed',
      details: {
        source: 'record_validation',
      },
    });
    expect(validateRecord(validRevocation, context)).toEqual({
      status: 'accepted',
      reason: 'validation_passed',
      details: {
        source: 'record_validation',
      },
    });

    const unauthorizedContext = {
      resolvePublicKeyByBindingHash(bindingHash: string) {
        if (bindingHash === 'hash_new_binding' || bindingHash === 'hash_signer_binding') {
          return identityC.publicKey;
        }
        return keyByBindingHash[bindingHash];
      },
    };

    expect(validateRecord(validKeyRotation, unauthorizedContext)).toMatchObject({
      status: 'rejected',
      phase: 'cryptographic',
      reason: 'invalid_signature',
      field: 'signatures.new_key',
    });
    expect(validateRecord(validRevocation, unauthorizedContext)).toMatchObject({
      status: 'rejected',
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
      status: 'rejected',
      phase: 'cryptographic',
      reason: 'signature_decode_failed',
      field: 'self_signature',
      details: {
        source: 'record_validation',
      },
    });
    expect(resultA).toEqual(resultB);
  });
});
