import type { DurableRecord, EndorsementRecord, IdentityBindingRecord, RevocationRecord } from '@/app/protocol/records';
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

describe('resolveTrustStates', () => {
  it('derives CLAIMED for a binding without supporting evidence', () => {
    const binding = identityBinding();

    expect(resolveTrustStates({ validatedRecords: [binding] })).toEqual([
      {
        bindingHash: deriveBindingHash(binding),
        trustState: 'CLAIMED',
        evidence: {},
      },
    ]);
  });

  it('derives TENTATIVE for a binding with low-confidence support and no conflicts', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const lowEndorsement = endorsement(bindingHash, { confidence_level: 'low' });

    expect(resolveTrustStates({ validatedRecords: [binding, lowEndorsement] })).toEqual([
      {
        bindingHash,
        trustState: 'TENTATIVE',
        evidence: {
          endorsements: [deriveRecordHash(lowEndorsement)],
        },
      },
    ]);
  });

  it('derives VERIFIED for a binding with high-confidence support and no conflicts', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const highEndorsement = endorsement(bindingHash, { confidence_level: 'high' });

    expect(resolveTrustStates({ validatedRecords: [binding, highEndorsement] })).toEqual([
      {
        bindingHash,
        trustState: 'VERIFIED',
        evidence: {
          endorsements: [deriveRecordHash(highEndorsement)],
        },
      },
    ]);
  });

  it('derives CONFLICTED for competing bindings that share a UUID', () => {
    const a = identityBinding({ subject_uuid: 'same-uuid', subject_identity_public_key: 'pub-a' });
    const b = identityBinding({ subject_uuid: 'same-uuid', subject_identity_public_key: 'pub-b' });

    const results = resolveTrustStates({ validatedRecords: [a, b] });

    expect(results).toEqual([
      {
        bindingHash: deriveBindingHash(a),
        trustState: 'CONFLICTED',
        evidence: {
          conflicts: [deriveBindingHash(b)],
        },
      },
      {
        bindingHash: deriveBindingHash(b),
        trustState: 'CONFLICTED',
        evidence: {
          conflicts: [deriveBindingHash(a)],
        },
      },
    ]);
  });

  it('derives REVOKED when revocation targets binding and overrides endorsements', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const highEndorsement = endorsement(bindingHash, { confidence_level: 'high' });
    const revoke = revocation(bindingHash);

    expect(resolveTrustStates({ validatedRecords: [binding, highEndorsement, revoke] })).toEqual([
      {
        bindingHash,
        trustState: 'REVOKED',
        evidence: {
          endorsements: [deriveRecordHash(highEndorsement)],
          revocations: [deriveRecordHash(revoke)],
        },
      },
    ]);
  });

  it('is deterministic for identical validated records', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);
    const records: DurableRecord[] = [binding, endorsement(bindingHash, { confidence_level: 'medium' })];

    const first = resolveTrustStates({ validatedRecords: records });
    const second = resolveTrustStates({ validatedRecords: records });

    expect(first).toEqual(second);
  });
});
