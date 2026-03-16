import type { DurableRecord, EndorsementRecord, IdentityBindingRecord, RevocationRecord } from '@/app/protocol/records';
import { resolveTrustStates } from '@/app/protocol/trust/resolveTrustState';
import { deriveBindingHash } from '@/app/protocol/trust/trustIndexes';

function identityBinding(overrides: Partial<IdentityBindingRecord> = {}): IdentityBindingRecord {
  return {
    record_type: 'identity_binding',
    record_version: 1,
    subject_uuid: 'uuid-deterministic',
    subject_identity_public_key: 'pub-key-deterministic',
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
    signature: 'sig-endorse',
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
    signature: 'sig-revoke',
    ...overrides,
  };
}

describe('trust resolution determinism', () => {
  it('produces byte-equal output across repeated runs and input permutations', () => {
    const binding = identityBinding();
    const bindingHash = deriveBindingHash(binding);

    const records: DurableRecord[] = [
      binding,
      endorsement(bindingHash, { endorser_binding_hash: 'endorser-z', signature: 'sig-z' }),
      endorsement(bindingHash, { endorser_binding_hash: 'endorser-a', signature: 'sig-a' }),
      revocation(bindingHash),
    ];

    const first = resolveTrustStates({ validatedRecords: records });
    const second = resolveTrustStates({ validatedRecords: records });
    const permuted = resolveTrustStates({ validatedRecords: [records[2], records[3], records[0], records[1]] });

    expect(first).toEqual(second);
    expect(first).toEqual(permuted);
    expect(first[0].trustState).toBe('REVOKED');
  });
});
