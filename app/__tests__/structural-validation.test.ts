import { validateRecordStructure } from '@/app/protocol';

describe('validateRecordStructure', () => {
  const validIdentityBinding = {
    record_type: 'identity_binding',
    record_version: 1,
    subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    subject_identity_public_key: 'did:key:z6Mki4R3K1x',
    key_epoch: 1,
    created_at: '2026-03-15T10:00:00.000Z',
    self_signature: 'sig_identity_binding_self',
  };

  const validEndorsement = {
    record_type: 'endorsement',
    record_version: 1,
    endorser_binding_hash: 'hash_endorser_binding',
    subject_binding_hash: 'hash_subject_binding',
    endorsement_type: 'binding_valid',
    signature: 'sig_endorsement',
  };

  const validHandshake = {
    record_type: 'handshake',
    record_version: 1,
    handshake_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
    participant_a_binding_hash: 'hash_binding_a',
    participant_b_binding_hash: 'hash_binding_b',
    participant_a_merkle_root: 'hash_merkle_root_a',
    participant_b_merkle_root: 'hash_merkle_root_b',
    ephemeral_keys: {
      participant_a: 'did:key:z6Mki4R3K1x',
      participant_b: 'did:key:z6Mki4R3K1y',
    },
    signatures: {
      participant_a: 'sig_handshake_a',
      participant_b: 'sig_handshake_b',
    },
  };

  const validKeyRotation = {
    record_type: 'key_rotation',
    record_version: 1,
    subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    old_binding_hash: 'hash_old_binding',
    new_binding_hash: 'hash_new_binding',
    rotation_counter: 2,
    signatures: {
      old_key: 'sig_rotation_old_key',
      new_key: 'sig_rotation_new_key',
    },
  };

  const validRevocation = {
    record_type: 'revocation',
    record_version: 1,
    signer_binding_hash: 'hash_signer_binding',
    target_record_hash: 'hash_target_record',
    reason_code: 'key_compromised',
    signature: 'sig_revocation',
  };

  it.each([
    validIdentityBinding,
    validEndorsement,
    validHandshake,
    validKeyRotation,
    validRevocation,
  ])('accepts a valid %s record', (payload) => {
    expect(validateRecordStructure(payload)).toEqual({ valid: true });
  });

  it('rejects missing required field', () => {
    const { self_signature: _selfSignature, ...payload } = validIdentityBinding;

    expect(validateRecordStructure(payload)).toEqual({
      valid: false,
      reason: 'missing_field',
      field: 'self_signature',
    });
  });

  it('rejects unknown record type', () => {
    expect(
      validateRecordStructure({
        ...validIdentityBinding,
        record_type: 'unknown',
      })
    ).toEqual({
      valid: false,
      reason: 'unknown_record_type',
      field: 'record_type',
    });
  });

  it('rejects malformed UUID', () => {
    expect(
      validateRecordStructure({
        ...validIdentityBinding,
        subject_uuid: 'not-a-uuid',
      })
    ).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'subject_uuid',
    });
  });

  it('rejects invalid timestamp', () => {
    expect(
      validateRecordStructure({
        ...validIdentityBinding,
        created_at: '03/15/2026',
      })
    ).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'created_at',
    });
  });

  it('rejects oversized fields', () => {
    expect(
      validateRecordStructure({
        ...validIdentityBinding,
        self_signature: 's'.repeat(5000),
      })
    ).toEqual({
      valid: false,
      reason: 'field_too_large',
      field: 'self_signature',
    });
  });

  it('rejects invalid schema version', () => {
    expect(
      validateRecordStructure({
        ...validIdentityBinding,
        record_version: 999,
      })
    ).toEqual({
      valid: false,
      reason: 'invalid_version',
      field: 'record_version',
    });
  });

  it('rejects endorsement with deprecated confidence_level field', () => {
    expect(
      validateRecordStructure({
        ...validEndorsement,
        confidence_level: 'high',
      })
    ).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'confidence_level',
    });
  });
});
