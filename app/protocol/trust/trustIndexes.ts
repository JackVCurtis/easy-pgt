import { createHash } from 'crypto';

import type { DurableRecord, EndorsementRecord, IdentityBindingRecord, RevocationRecord } from '@/app/protocol/records';
import { canonicalSerialize } from '@/app/protocol/validation/crypto/signingPayload';

export interface TrustIndexes {
  bindingOrder: string[];
  bindingsByHash: Map<string, IdentityBindingRecord>;
  endorsementsByBinding: Map<string, EndorsementRecord[]>;
  revocationsByBinding: Map<string, RevocationRecord[]>;
  conflictsByBinding: Map<string, Set<string>>;
  conflictingEndorsementsByBinding: Map<string, EndorsementRecord[]>;
}

export function deriveRecordHash(record: DurableRecord): string {
  const canonical = canonicalSerialize(record as unknown as Record<string, unknown>);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return `hash_${hash}`;
}

export function deriveBindingHash(binding: IdentityBindingRecord): string {
  return deriveRecordHash(binding);
}

export function buildTrustIndexes(records: DurableRecord[]): TrustIndexes {
  const bindingOrder: string[] = [];
  const bindingsByHash = new Map<string, IdentityBindingRecord>();
  const endorsementsByBinding = new Map<string, EndorsementRecord[]>();
  const revocationsByBinding = new Map<string, RevocationRecord[]>();
  const conflictsByBinding = new Map<string, Set<string>>();
  const conflictingEndorsementsByBinding = new Map<string, EndorsementRecord[]>();

  const bindingsBySubject = new Map<string, string[]>();
  const endorsementTypesBySubject = new Map<string, Set<string>>();

  for (const record of records) {
    const recordHash = deriveRecordHash(record);

    if (record.record_type === 'identity_binding') {
      const bindingHash = recordHash;
      bindingOrder.push(bindingHash);
      bindingsByHash.set(bindingHash, record);

      const knownBindings = bindingsBySubject.get(record.subject_uuid) ?? [];
      knownBindings.push(bindingHash);
      bindingsBySubject.set(record.subject_uuid, knownBindings);
      continue;
    }

    if (record.record_type === 'endorsement') {
      const known = endorsementsByBinding.get(record.subject_binding_hash) ?? [];
      known.push(record);
      endorsementsByBinding.set(record.subject_binding_hash, known);

      const knownTypes = endorsementTypesBySubject.get(record.subject_binding_hash) ?? new Set<string>();
      knownTypes.add(record.endorsement_type);
      endorsementTypesBySubject.set(record.subject_binding_hash, knownTypes);
      continue;
    }

    if (record.record_type === 'revocation') {
      const known = revocationsByBinding.get(record.target_record_hash) ?? [];
      known.push(record);
      revocationsByBinding.set(record.target_record_hash, known);
    }
  }

  for (const bindingHashes of bindingsBySubject.values()) {
    if (bindingHashes.length < 2) {
      continue;
    }

    const sorted = [...bindingHashes].sort();
    for (const bindingHash of sorted) {
      const competing = new Set(sorted.filter((hash) => hash !== bindingHash));
      conflictsByBinding.set(bindingHash, competing);
    }
  }

  for (const [bindingHash, types] of endorsementTypesBySubject.entries()) {
    if (!types.has('binding_valid') || !types.has('binding_invalid')) {
      continue;
    }

    const endorsements = endorsementsByBinding.get(bindingHash) ?? [];
    conflictingEndorsementsByBinding.set(bindingHash, endorsements);

    const existing = conflictsByBinding.get(bindingHash) ?? new Set<string>();
    existing.add('conflicting_endorsements');
    conflictsByBinding.set(bindingHash, existing);
  }

  bindingOrder.sort();

  return {
    bindingOrder,
    bindingsByHash,
    endorsementsByBinding,
    revocationsByBinding,
    conflictsByBinding,
    conflictingEndorsementsByBinding,
  };
}
