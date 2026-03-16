import {
  durableRecordSchema,
  endorsementSchema,
  handshakeSchema,
  identityBindingSchema,
  keyRotationSchema,
  revocationSchema,
} from '@/app/protocol';

describe('durable record schemas', () => {
  const validIdentityBinding = {
    record_type: 'identity_binding',
    record_version: 1,
    subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    subject_identity_public_key: 'did:key:z6Mki4R3K1x',
    key_epoch: 1,
    created_at: '2026-03-15T10:00:00.000Z',
    self_signature: 'sig_identity_binding_self',
  };

  it.each([
    ['identity_binding', identityBindingSchema, validIdentityBinding],
    [
      'endorsement',
      endorsementSchema,
      {
        record_type: 'endorsement',
        record_version: 1,
        endorser_binding_hash: 'hash_endorser_binding',
        subject_binding_hash: 'hash_subject_binding',
        endorsement_type: 'binding_valid',
        signature: 'sig_endorsement',
      },
    ],
    [
      'handshake',
      handshakeSchema,
      {
        record_type: 'handshake',
        record_version: 1,
        handshake_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
        participant_a_binding_hash: 'hash_binding_a',
        participant_b_binding_hash: 'hash_binding_b',
        participant_a_merkle_root: 'hash_merkle_root_a',
        participant_b_merkle_root: 'hash_merkle_root_b',
        ephemeral_keys: {
          participant_a: 'ephemeral_pubkey_a',
          participant_b: 'ephemeral_pubkey_b',
        },
        signatures: {
          participant_a: 'sig_handshake_a',
          participant_b: 'sig_handshake_b',
        },
      },
    ],
    [
      'key_rotation',
      keyRotationSchema,
      {
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
      },
    ],
    [
      'revocation',
      revocationSchema,
      {
        record_type: 'revocation',
        record_version: 1,
        signer_binding_hash: 'hash_signer_binding',
        target_record_hash: 'hash_target_record',
        reason_code: 'key_compromised',
        signature: 'sig_revocation',
      },
    ],
  ])('accepts valid %s payloads', (_, schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(true);
    expect(durableRecordSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an invalid record_type discriminator', () => {
    const payload = {
      ...validIdentityBinding,
      record_type: 'identity_bindings',
    };

    expect(identityBindingSchema.safeParse(payload).success).toBe(false);
    expect(durableRecordSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects invalid record_version', () => {
    const payload = {
      ...validIdentityBinding,
      record_version: 2,
    };

    expect(identityBindingSchema.safeParse(payload).success).toBe(false);
    expect(durableRecordSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects payloads with missing required fields', () => {
    const { self_signature: _selfSignature, ...missingFieldPayload } = validIdentityBinding;

    expect(identityBindingSchema.safeParse(missingFieldPayload).success).toBe(false);
    expect(durableRecordSchema.safeParse(missingFieldPayload).success).toBe(false);
  });

  it('rejects endorsement payloads with unknown fields', () => {
    const payload = {
      record_type: 'endorsement',
      record_version: 1,
      endorser_binding_hash: 'hash_endorser_binding',
      subject_binding_hash: 'hash_subject_binding',
      endorsement_type: 'binding_valid',
      confidence_level: 'high',
      signature: 'sig_endorsement',
    };

    expect(endorsementSchema.safeParse(payload).success).toBe(false);
    expect(durableRecordSchema.safeParse(payload).success).toBe(false);
  });
});
