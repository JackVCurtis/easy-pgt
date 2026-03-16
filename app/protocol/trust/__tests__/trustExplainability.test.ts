import type { DurableRecord, EndorsementRecord, IdentityBindingRecord } from '@/app/protocol/records';
import { resolveTrustStates } from '@/app/protocol/trust/resolveTrustState';
import { deriveBindingHash, deriveRecordHash } from '@/app/protocol/trust/trustIndexes';

function identityBinding(overrides: Partial<IdentityBindingRecord> = {}): IdentityBindingRecord {
  return {
    record_type: 'identity_binding',
    record_version: 1,
    subject_uuid: 'uuid-explain',
    subject_identity_public_key: 'pub-key-explain',
    key_epoch: 0,
    created_at: '2026-03-15T10:00:00.000Z',
    self_signature: 'sig-self',
    ...overrides,
  };
}

function endorsement(subjectBindingHash: string, overrides: Partial<EndorsementRecord> = {}): EndorsementRecord {
  return {
    record_type: 'endorsement',
    record_version: 1,
    endorser_binding_hash: 'endorser-default',
    subject_binding_hash: subjectBindingHash,
    endorsement_type: 'binding_valid',
    confidence_level: 'low',
    signature: 'sig-endorse',
    ...overrides,
  };
}

describe('trust explainability evidence', () => {
  it('returns sorted deduplicated evidence arrays and deterministic contribution accounting', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);

    const valid = endorsement(bindingHash, {
      endorser_binding_hash: 'endorser-a',
      confidence_level: 'high',
      signature: 'sig-a',
    });
    const invalid = endorsement(bindingHash, {
      endorser_binding_hash: 'endorser-b',
      endorsement_type: 'binding_invalid',
      confidence_level: 'medium',
      signature: 'sig-b',
    });

    const records: DurableRecord[] = [binding, valid, invalid, valid];
    const [result] = resolveTrustStates({ validatedRecords: records });

    const validHash = deriveRecordHash(valid);
    const invalidHash = deriveRecordHash(invalid);
    const sortedHashes = [invalidHash, validHash].sort();

    expect(result.evidence.endorsements).toEqual(sortedHashes);
    expect(result.evidence.revocations).toEqual([]);
    expect(result.evidence.conflicts).toEqual([]);
    expect(result.evidence.endorsementSummary).toMatchObject({
      positiveScore: 3,
      negativeScore: 2,
      netScore: 1,
      endorsementHashes: sortedHashes,
    });
    expect(result.evidence.endorsementSummary.contributions).toEqual(
      [...result.evidence.endorsementSummary.contributions].sort((a, b) => a.endorsementHash.localeCompare(b.endorsementHash))
    );
    expect(result.evidence.endorsementSummary.contributions).toEqual(
      expect.arrayContaining([
        {
          endorsementHash: validHash,
          endorserBindingHash: 'endorser-a',
          endorsementType: 'binding_valid',
          confidenceLevel: 'high',
          weight: 3,
        },
        {
          endorsementHash: invalidHash,
          endorserBindingHash: 'endorser-b',
          endorsementType: 'binding_invalid',
          confidenceLevel: 'medium',
          weight: -2,
        },
      ])
    );
    expect(result.trustState).toBe('TENTATIVE');
  });
});
