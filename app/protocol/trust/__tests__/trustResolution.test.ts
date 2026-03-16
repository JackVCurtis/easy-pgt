import type { DurableRecord, EndorsementRecord, IdentityBindingRecord, KeyRotationRecord, RevocationRecord } from '@/app/protocol/records';
import { resolveTrustStates } from '@/app/protocol/trust/resolveTrustState';
import { deriveBindingHash, deriveRecordHash } from '@/app/protocol/trust/trustIndexes';

function identityBinding(overrides: Partial<IdentityBindingRecord> = {}): IdentityBindingRecord {
  return {
    record_type: 'identity_binding',
    record_version: 1,
    subject_uuid: 'uuid-1',
    subject_identity_public_key: 'pub-key-1',
    key_epoch: 0,
    created_at: '2026-03-15T10:00:00.000Z',
    self_signature: 'sig',
    ...overrides,
  };
}

function endorsement(subjectBindingHash: string, overrides: Partial<EndorsementRecord> = {}): EndorsementRecord {
  return {
    record_type: 'endorsement',
    record_version: 1,
    endorser_binding_hash: 'hash-endorser',
    subject_binding_hash: subjectBindingHash,
    endorsement_type: 'binding_valid',
    confidence_level: 'low',
    signature: 'sig',
    ...overrides,
  };
}

function revocation(targetRecordHash: string, overrides: Partial<RevocationRecord> = {}): RevocationRecord {
  return {
    record_type: 'revocation',
    record_version: 1,
    signer_binding_hash: 'hash-signer',
    target_record_hash: targetRecordHash,
    reason_code: 'other',
    signature: 'sig',
    ...overrides,
  };
}

function keyRotation(oldBindingHash: string, newBindingHash: string, overrides: Partial<KeyRotationRecord> = {}): KeyRotationRecord {
  return {
    record_type: 'key_rotation',
    record_version: 1,
    subject_uuid: 'uuid-1',
    old_binding_hash: oldBindingHash,
    new_binding_hash: newBindingHash,
    rotation_counter: 1,
    signatures: {
      old_key: 'sig-old',
      new_key: 'sig-new',
    },
    ...overrides,
  };
}

describe('resolveTrustStates', () => {
  it('derives CLAIMED for a binding without endorsements', () => {
    const binding = identityBinding();

    expect(resolveTrustStates({ validatedRecords: [binding] })).toEqual([
      {
        bindingHash: deriveBindingHash(binding),
        trustState: 'CLAIMED',
        evidence: {
          endorsementSummary: {
            positiveScore: 0,
            negativeScore: 0,
            netScore: 0,
            endorsementHashes: [],
            contributions: [],
          },
        },
      },
    ]);
  });

  it('derives TENTATIVE for one low valid endorsement', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const low = endorsement(bindingHash, { confidence_level: 'low' });

    expect(resolveTrustStates({ validatedRecords: [binding, low] })).toEqual([
      {
        bindingHash,
        trustState: 'TENTATIVE',
        evidence: {
          endorsements: [deriveRecordHash(low)],
          endorsementSummary: {
            positiveScore: 1,
            negativeScore: 0,
            netScore: 1,
            endorsementHashes: [deriveRecordHash(low)],
            contributions: [
              {
                endorsementHash: deriveRecordHash(low),
                endorserBindingHash: low.endorser_binding_hash,
                endorsementType: low.endorsement_type,
                confidenceLevel: low.confidence_level,
                weight: 1,
              },
            ],
          },
        },
      },
    ]);
  });

  it('derives VERIFIED for one high valid endorsement', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const high = endorsement(bindingHash, { confidence_level: 'high' });

    const [result] = resolveTrustStates({ validatedRecords: [binding, high] });

    expect(result.trustState).toBe('VERIFIED');
    expect(result.evidence.endorsementSummary).toMatchObject({
      positiveScore: 3,
      negativeScore: 0,
      netScore: 3,
    });
  });

  it('allows multiple low endorsements to combine into VERIFIED', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const records: DurableRecord[] = [
      binding,
      endorsement(bindingHash, { endorser_binding_hash: 'endorser-a', signature: 'sig-a' }),
      endorsement(bindingHash, { endorser_binding_hash: 'endorser-b', signature: 'sig-b' }),
      endorsement(bindingHash, { endorser_binding_hash: 'endorser-c', signature: 'sig-c' }),
    ];

    const [result] = resolveTrustStates({ validatedRecords: records });

    expect(result.trustState).toBe('VERIFIED');
    expect(result.evidence.endorsementSummary).toMatchObject({
      positiveScore: 3,
      negativeScore: 0,
      netScore: 3,
    });
  });

  it('applies mixed positive/negative endorsements to lower weighted trust outcome', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);

    const records: DurableRecord[] = [
      binding,
      endorsement(bindingHash, {
        endorser_binding_hash: 'endorser-a',
        endorsement_type: 'binding_valid',
        confidence_level: 'high',
        signature: 'sig-a',
      }),
      endorsement(bindingHash, {
        endorser_binding_hash: 'endorser-b',
        endorsement_type: 'binding_valid',
        confidence_level: 'low',
        signature: 'sig-b',
      }),
      endorsement(bindingHash, {
        endorser_binding_hash: 'endorser-c',
        endorsement_type: 'binding_invalid',
        confidence_level: 'medium',
        signature: 'sig-c',
      }),
    ];

    const [result] = resolveTrustStates({ validatedRecords: records });

    expect(result.trustState).toBe('TENTATIVE');
    expect(result.evidence.endorsementSummary).toMatchObject({
      positiveScore: 4,
      negativeScore: 2,
      netScore: 2,
    });
  });

  it('derives CONFLICTED for contradictory endorsements from the same endorser', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);

    const [result] = resolveTrustStates({
      validatedRecords: [
        binding,
        endorsement(bindingHash, {
          endorser_binding_hash: 'endorser-a',
          endorsement_type: 'binding_valid',
          confidence_level: 'high',
          signature: 'sig-a',
        }),
        endorsement(bindingHash, {
          endorser_binding_hash: 'endorser-a',
          endorsement_type: 'binding_invalid',
          confidence_level: 'low',
          signature: 'sig-a-2',
        }),
      ],
    });

    expect(result.trustState).toBe('CONFLICTED');
    const valid = endorsement(bindingHash, {
      endorser_binding_hash: 'endorser-a',
      endorsement_type: 'binding_valid',
      confidence_level: 'high',
      signature: 'sig-a',
    });
    const invalid = endorsement(bindingHash, {
      endorser_binding_hash: 'endorser-a',
      endorsement_type: 'binding_invalid',
      confidence_level: 'low',
      signature: 'sig-a-2',
    });

    const [resultWithEvidence] = resolveTrustStates({
      validatedRecords: [binding, valid, invalid],
    });

    expect(resultWithEvidence.evidence.conflicts).toEqual([deriveRecordHash(invalid), deriveRecordHash(valid)].sort());
  });


  it('derives CONFLICTED for competing bindings that share a UUID', () => {
    const a = identityBinding({ subject_uuid: 'same-uuid', subject_identity_public_key: 'pub-a' });
    const b = identityBinding({ subject_uuid: 'same-uuid', subject_identity_public_key: 'pub-b' });

    const results = resolveTrustStates({ validatedRecords: [a, b] });

    const aHash = deriveBindingHash(a);
    const bHash = deriveBindingHash(b);
    const expectedConflicts = [aHash, bHash].sort();

    expect(results).toEqual([
      {
        bindingHash: aHash,
        trustState: 'CONFLICTED',
        evidence: {
          conflicts: expectedConflicts,
          endorsementSummary: {
            positiveScore: 0,
            negativeScore: 0,
            netScore: 0,
            endorsementHashes: [],
            contributions: [],
          },
        },
      },
      {
        bindingHash: bHash,
        trustState: 'CONFLICTED',
        evidence: {
          conflicts: expectedConflicts,
          endorsementSummary: {
            positiveScore: 0,
            negativeScore: 0,
            netScore: 0,
            endorsementHashes: [],
            contributions: [],
          },
        },
      },
    ]);
  });

  it('derives REVOKED when revocation targets binding regardless of score', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const high = endorsement(bindingHash, { confidence_level: 'high' });
    const revoke = revocation(bindingHash);

    const [result] = resolveTrustStates({ validatedRecords: [binding, high, revoke] });

    expect(result.trustState).toBe('REVOKED');
    expect(result.evidence.revocations).toEqual([deriveRecordHash(revoke)]);
  });

  it('keeps rotated bindings historical while only active binding can become supported', () => {
    const bindingA = identityBinding({ key_epoch: 0, subject_identity_public_key: 'pub-key-a' });
    const bindingB = identityBinding({ key_epoch: 1, subject_identity_public_key: 'pub-key-b', created_at: '2026-03-15T11:00:00.000Z' });
    const bindingAHash = deriveBindingHash(bindingA);
    const bindingBHash = deriveBindingHash(bindingB);

    const records: DurableRecord[] = [
      bindingA,
      bindingB,
      keyRotation(bindingAHash, bindingBHash),
      endorsement(bindingAHash, {
        endorser_binding_hash: 'endorser-a',
        confidence_level: 'high',
        signature: 'sig-endorse-a',
      }),
      endorsement(bindingBHash, {
        endorser_binding_hash: 'endorser-b',
        confidence_level: 'high',
        signature: 'sig-endorse-b',
      }),
    ];

    const results = resolveTrustStates({ validatedRecords: records });
    const historical = results.find((result) => result.bindingHash === bindingAHash);
    const active = results.find((result) => result.bindingHash === bindingBHash);

    expect(historical).toMatchObject({
      trustState: 'CLAIMED',
      evidence: {
        endorsements: [deriveRecordHash(records[3])],
      },
    });
    expect(active).toMatchObject({
      trustState: 'VERIFIED',
      evidence: {
        endorsements: [deriveRecordHash(records[4])],
      },
    });
  });

  it('keeps active rotated binding revoked when revocation targets it', () => {
    const bindingA = identityBinding({ key_epoch: 0, subject_identity_public_key: 'pub-key-a' });
    const bindingB = identityBinding({ key_epoch: 1, subject_identity_public_key: 'pub-key-b', created_at: '2026-03-15T11:00:00.000Z' });
    const bindingAHash = deriveBindingHash(bindingA);
    const bindingBHash = deriveBindingHash(bindingB);
    const revokeBindingB = revocation(bindingBHash, { signature: 'sig-revoke-b' });

    const records: DurableRecord[] = [
      bindingA,
      bindingB,
      keyRotation(bindingAHash, bindingBHash),
      endorsement(bindingBHash, {
        endorser_binding_hash: 'endorser-b',
        confidence_level: 'high',
        signature: 'sig-endorse-b',
      }),
      revokeBindingB,
    ];

    const results = resolveTrustStates({ validatedRecords: records });
    const historical = results.find((result) => result.bindingHash === bindingAHash);
    const active = results.find((result) => result.bindingHash === bindingBHash);

    expect(historical?.trustState).toBe('CLAIMED');
    expect(active).toMatchObject({
      trustState: 'REVOKED',
      evidence: {
        revocations: [deriveRecordHash(revokeBindingB)],
      },
    });
  });

  it('does not double count duplicate endorsement records', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const duplicate = endorsement(bindingHash, {
      endorser_binding_hash: 'endorser-a',
      confidence_level: 'high',
      signature: 'sig-a',
    });

    const [result] = resolveTrustStates({ validatedRecords: [binding, duplicate, duplicate] });

    expect(result.evidence.endorsementSummary).toMatchObject({
      positiveScore: 3,
      negativeScore: 0,
      netScore: 3,
      endorsementHashes: [deriveRecordHash(duplicate)],
    });
  });

  it('is deterministic for identical input order and permutations', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const records: DurableRecord[] = [
      binding,
      endorsement(bindingHash, {
        endorser_binding_hash: 'endorser-c',
        confidence_level: 'medium',
        signature: 'sig-c',
      }),
      endorsement(bindingHash, {
        endorser_binding_hash: 'endorser-a',
        confidence_level: 'high',
        signature: 'sig-a',
      }),
      endorsement(bindingHash, {
        endorser_binding_hash: 'endorser-b',
        confidence_level: 'low',
        signature: 'sig-b',
      }),
    ];

    const first = resolveTrustStates({ validatedRecords: records });
    const second = resolveTrustStates({ validatedRecords: records });
    const permutation = resolveTrustStates({ validatedRecords: [records[3], records[0], records[2], records[1]] });

    expect(first).toEqual(second);
    expect(first).toEqual(permutation);
  });

  it('derives CONFLICTED with all binding hashes for ambiguous rotation chains', () => {
    const bindingA = identityBinding({ key_epoch: 0, subject_identity_public_key: 'pub-key-a' });
    const bindingB = identityBinding({ key_epoch: 1, subject_identity_public_key: 'pub-key-b', created_at: '2026-03-15T11:00:00.000Z' });
    const bindingC = identityBinding({ key_epoch: 2, subject_identity_public_key: 'pub-key-c', created_at: '2026-03-15T12:00:00.000Z' });
    const bindingAHash = deriveBindingHash(bindingA);
    const bindingBHash = deriveBindingHash(bindingB);
    const bindingCHash = deriveBindingHash(bindingC);

    const records: DurableRecord[] = [
      bindingA,
      bindingB,
      bindingC,
      keyRotation(bindingAHash, bindingBHash, { rotation_counter: 1, signatures: { old_key: 'sig-old-1', new_key: 'sig-new-1' } }),
      keyRotation(bindingAHash, bindingCHash, { rotation_counter: 2, signatures: { old_key: 'sig-old-2', new_key: 'sig-new-2' } }),
    ];

    const results = resolveTrustStates({ validatedRecords: records });
    const expectedConflicts = [bindingAHash, bindingBHash, bindingCHash].sort();

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.trustState).toBe('CONFLICTED');
      expect(result.evidence.conflicts).toEqual(expectedConflicts);
    }
  });

  it('produces deterministic conflict ordering regardless of input order', () => {
    const a = identityBinding({ subject_uuid: 'same-uuid', subject_identity_public_key: 'pub-a' });
    const b = identityBinding({ subject_uuid: 'same-uuid', subject_identity_public_key: 'pub-b' });
    const c = identityBinding({ subject_uuid: 'same-uuid', subject_identity_public_key: 'pub-c' });

    const ordered = resolveTrustStates({ validatedRecords: [a, b, c] });
    const permuted = resolveTrustStates({ validatedRecords: [c, a, b] });

    expect(ordered).toEqual(permuted);
    for (const result of ordered) {
      expect(result.trustState).toBe('CONFLICTED');
      expect(result.evidence.conflicts).toEqual([...result.evidence.conflicts ?? []].sort());
    }
  });
});
