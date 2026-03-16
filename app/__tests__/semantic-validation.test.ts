import type { DurableRecord, IdentityBindingRecord, KeyRotationRecord, RevocationRecord } from '@/app/protocol/records';
import {
  type SemanticValidationContext,
  validateRecordSemantics,
} from '@/app/protocol/validation/validateRecordSemantics';

function identityBinding(overrides: Partial<IdentityBindingRecord> = {}): IdentityBindingRecord {
  return {
    record_type: 'identity_binding',
    record_version: 1,
    subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    subject_identity_public_key: 'cHVibGljX2tleQ==',
    key_epoch: 0,
    created_at: '2026-03-15T10:00:00.000Z',
    self_signature: 'c2ln',
    ...overrides,
  };
}

function keyRotation(overrides: Partial<KeyRotationRecord> = {}): KeyRotationRecord {
  return {
    record_type: 'key_rotation',
    record_version: 1,
    subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    old_binding_hash: 'hash_old_binding',
    new_binding_hash: 'hash_new_binding',
    rotation_counter: 2,
    signatures: {
      old_key: 'c2lnX29sZA==',
      new_key: 'c2lnX25ldw==',
    },
    ...overrides,
  };
}

function revocation(overrides: Partial<RevocationRecord> = {}): RevocationRecord {
  return {
    record_type: 'revocation',
    record_version: 1,
    signer_binding_hash: 'hash_signer_binding',
    target_record_hash: 'hash_target_record',
    reason_code: 'other',
    signature: 'c2ln',
    ...overrides,
  };
}

describe('semantic validation rules', () => {
  it('rejects duplicate records by record hash, including replayed sync records', () => {
    const record = identityBinding();
    const duplicateHash = 'hash_duplicate';
    const context: SemanticValidationContext = {
      candidateRecordHash: duplicateHash,
      localLogState: {
        knownRecordHashes: [duplicateHash],
      },
    };

    expect(validateRecordSemantics(record, context)).toEqual({
      result: 'rejected',
      reason: 'duplicate_record',
    });
  });

  it('marks conflicting identity bindings as conflicted when UUID maps to another key', () => {
    const incoming = identityBinding({
      subject_uuid: '11f4e3f1-9f25-429d-93c9-4fc1d9df7f22',
      subject_identity_public_key: 'cHVibGljX2tleV9uZXc=',
    });

    const context: SemanticValidationContext = {
      localLogState: {
        identityBindingsBySubjectUuid: {
          '11f4e3f1-9f25-429d-93c9-4fc1d9df7f22': ['cHVibGljX2tleV9vbGQ='],
        },
      },
    };

    expect(validateRecordSemantics(incoming, context)).toEqual({
      result: 'conflicted',
      reason: 'conflicting_identity_binding',
    });
  });

  it('marks conflicting revocations as conflicted for same signer and target with different reasons', () => {
    const incoming = revocation({ reason_code: 'superseded' });
    const context: SemanticValidationContext = {
      localLogState: {
        revocationsBySignerAndTarget: {
          'hash_signer_binding::hash_target_record': ['other'],
        },
      },
    };

    expect(validateRecordSemantics(incoming, context)).toEqual({
      result: 'conflicted',
      reason: 'conflicting_revocation',
    });
  });

  it('enforces key rotation monotonicity rules', () => {
    const subjectUuid = '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7';
    const validRotation = keyRotation({ subject_uuid: subjectUuid, old_binding_hash: 'hash_active', new_binding_hash: 'hash_next', rotation_counter: 5 });
    const state = {
      activeBindingHashBySubjectUuid: { [subjectUuid]: 'hash_active' },
      lastRotationCounterBySubjectUuid: { [subjectUuid]: 4 },
      usedBindingHashesBySubjectUuid: { [subjectUuid]: ['hash_active', 'hash_prev'] },
    };

    expect(validateRecordSemantics(validRotation, { localLogState: state })).toEqual({ result: 'accepted' });

    const wrongPredecessor = keyRotation({ subject_uuid: subjectUuid, old_binding_hash: 'hash_wrong', new_binding_hash: 'hash_next_2', rotation_counter: 5 });
    expect(validateRecordSemantics(wrongPredecessor, { localLogState: state })).toEqual({
      result: 'rejected',
      reason: 'rotation_old_key_mismatch',
    });

    const revertedKey = keyRotation({ subject_uuid: subjectUuid, old_binding_hash: 'hash_active', new_binding_hash: 'hash_prev', rotation_counter: 5 });
    expect(validateRecordSemantics(revertedKey, { localLogState: state })).toEqual({
      result: 'rejected',
      reason: 'rotation_reuses_historical_key',
    });
  });

  it('is deterministic for identical input state and candidate record', () => {
    const record: DurableRecord = keyRotation({
      subject_uuid: 'd4d625f6-b0e0-43d1-bde7-fc9f31b72db6',
      old_binding_hash: 'hash_current',
      new_binding_hash: 'hash_next',
      rotation_counter: 3,
    });
    const context: SemanticValidationContext = {
      candidateRecordHash: 'hash_new_candidate',
      localLogState: {
        knownRecordHashes: ['hash_1', 'hash_2'],
        activeBindingHashBySubjectUuid: { 'd4d625f6-b0e0-43d1-bde7-fc9f31b72db6': 'hash_current' },
        lastRotationCounterBySubjectUuid: { 'd4d625f6-b0e0-43d1-bde7-fc9f31b72db6': 2 },
        usedBindingHashesBySubjectUuid: { 'd4d625f6-b0e0-43d1-bde7-fc9f31b72db6': ['hash_old', 'hash_current'] },
      },
    };

    const resultA = validateRecordSemantics(record, context);
    const resultB = validateRecordSemantics(record, context);
    expect(resultA).toEqual(resultB);
    expect(resultA).toEqual({ result: 'accepted' });
  });
});
