import { decodeDurableRecord, type DurableRecordDecodeResult } from '@/app/protocol';

const validIdentityBinding = {
  record_type: 'identity_binding',
  record_version: 1,
  subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
  subject_identity_public_key: 'did:key:z6Mki4R3K1x',
  key_epoch: 1,
  created_at: '2026-03-15T10:00:00.000Z',
  self_signature: 'sig_identity_binding_self',
};

const validRecords = [
  validIdentityBinding,
  {
    record_type: 'endorsement',
    record_version: 1,
    endorser_binding_hash: 'hash_endorser_binding',
    subject_binding_hash: 'hash_subject_binding',
    endorsement_type: 'binding_valid',
    confidence_level: 'high',
    signature: 'sig_endorsement',
  },
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
  {
    record_type: 'revocation',
    record_version: 1,
    signer_binding_hash: 'hash_signer_binding',
    target_record_hash: 'hash_target_record',
    reason_code: 'key_compromised',
    signature: 'sig_revocation',
  },
] as const;

function expectRejectedCode(result: DurableRecordDecodeResult, code: DurableRecordDecodeResult['code']) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected decode to fail');
  }
  expect(result.code).toBe(code);
}

describe('decodeDurableRecord', () => {
  it('accepts all currently supported record type/version pairs', () => {
    for (const payload of validRecords) {
      const result = decodeDurableRecord(payload);
      expect(result.ok).toBe(true);
    }
  });

  it('rejects unknown record types', () => {
    const result = decodeDurableRecord({
      ...validIdentityBinding,
      record_type: 'unknown_record_type',
    });

    expectRejectedCode(result, 'unknown_record_type');
  });

  it('rejects missing version', () => {
    const { record_version: _recordVersion, ...payloadWithoutVersion } = validIdentityBinding;

    const result = decodeDurableRecord(payloadWithoutVersion);

    expectRejectedCode(result, 'missing_record_version');
  });

  it('rejects null version as malformed', () => {
    const result = decodeDurableRecord({
      ...validIdentityBinding,
      record_version: null,
    });

    expectRejectedCode(result, 'malformed_record_version');
  });

  it.each([
    ['string', '1'],
    ['floating number', 1.5],
    ['negative number', -1],
    ['zero', 0],
  ])('rejects %s version values as malformed', (_name, version) => {
    const result = decodeDurableRecord({
      ...validIdentityBinding,
      record_version: version,
    });

    expectRejectedCode(result, 'malformed_record_version');
  });

  it('rejects unsupported but well-formed versions', () => {
    const result = decodeDurableRecord({
      ...validIdentityBinding,
      record_version: 2,
    });

    expectRejectedCode(result, 'unsupported_record_version');
  });

  it('returns schema_parse_failure for supported version with malformed payload fields', () => {
    const result = decodeDurableRecord({
      ...validIdentityBinding,
      subject_identity_public_key: 123,
    });

    expectRejectedCode(result, 'schema_parse_failure');
  });

  it('does not attempt schema parsing for malformed or unsupported versions', () => {
    const schemaParseAttempt = jest.fn();

    decodeDurableRecord(
      {
        ...validIdentityBinding,
        record_version: '1',
      },
      { onSchemaParseAttempt: schemaParseAttempt }
    );

    decodeDurableRecord(
      {
        ...validIdentityBinding,
        record_version: 99,
      },
      { onSchemaParseAttempt: schemaParseAttempt }
    );

    expect(schemaParseAttempt).not.toHaveBeenCalled();
  });
});
