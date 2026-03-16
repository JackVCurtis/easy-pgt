import { createHash } from 'crypto';

import type {
  DurableRecord,
  EndorsementRecord,
  IdentityBindingRecord,
  KeyRotationRecord,
  RevocationRecord,
} from '@/app/protocol/records';
import { canonicalSerialize } from '@/app/protocol/validation/crypto/signingPayload';

export interface TrustIndexes {
  bindingOrder: string[];
  bindingsByHash: Map<string, IdentityBindingRecord>;
  endorsementsByBinding: Map<string, EndorsementRecord[]>;
  revocationsByBinding: Map<string, RevocationRecord[]>;
  conflictsByBinding: Map<string, Set<string>>;
  conflictingEndorsementsByBinding: Map<string, EndorsementRecord[]>;
  activeBindingBySubject: Map<string, string>;
}

export function deriveRecordHash(record: DurableRecord): string {
  const canonical = canonicalSerialize(record as unknown as Record<string, unknown>);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return `hash_${hash}`;
}

export function deriveBindingHash(binding: IdentityBindingRecord): string {
  return deriveRecordHash(binding);
}

function determineActiveBindingForSubject(bindingHashes: string[], rotations: KeyRotationRecord[]): string | undefined {
  if (bindingHashes.length === 1) {
    return bindingHashes[0];
  }

  if (rotations.length === 0) {
    return undefined;
  }

  const knownBindings = new Set(bindingHashes);
  const filteredRotations = rotations
    .filter((rotation) => knownBindings.has(rotation.old_binding_hash) && knownBindings.has(rotation.new_binding_hash))
    .map((rotation) => ({ ...rotation, rotationHash: deriveRecordHash(rotation) }));

  if (filteredRotations.length === 0) {
    return undefined;
  }

  const predecessorCounts = new Map<string, number>();
  const successorCounts = new Map<string, number>();

  for (const rotation of filteredRotations) {
    successorCounts.set(rotation.old_binding_hash, (successorCounts.get(rotation.old_binding_hash) ?? 0) + 1);
    predecessorCounts.set(rotation.new_binding_hash, (predecessorCounts.get(rotation.new_binding_hash) ?? 0) + 1);
  }

  const hasBranching = [...successorCounts.values()].some((count) => count > 1) || [...predecessorCounts.values()].some((count) => count > 1);
  if (hasBranching) {
    return undefined;
  }

  const oldTargets = new Set(filteredRotations.map((rotation) => rotation.old_binding_hash));
  const newTargets = new Set(filteredRotations.map((rotation) => rotation.new_binding_hash));

  const heads = [...knownBindings].filter((bindingHash) => newTargets.has(bindingHash) && !oldTargets.has(bindingHash)).sort();
  const unrotated = [...knownBindings].filter((bindingHash) => !oldTargets.has(bindingHash) && !newTargets.has(bindingHash)).sort();
  const candidates = heads.length > 0 ? heads : unrotated;

  return candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
}

export function buildTrustIndexes(records: DurableRecord[]): TrustIndexes {
  const bindingOrder: string[] = [];
  const bindingsByHash = new Map<string, IdentityBindingRecord>();
  const endorsementsByBinding = new Map<string, EndorsementRecord[]>();
  const revocationsByBinding = new Map<string, RevocationRecord[]>();
  const conflictsByBinding = new Map<string, Set<string>>();
  const conflictingEndorsementsByBinding = new Map<string, EndorsementRecord[]>();

  const bindingsBySubject = new Map<string, string[]>();
  const rotationsBySubject = new Map<string, KeyRotationRecord[]>();
  const endorsementTypesBySubjectAndEndorser = new Map<string, Map<string, Set<string>>>();

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

      const byEndorser = endorsementTypesBySubjectAndEndorser.get(record.subject_binding_hash) ?? new Map<string, Set<string>>();
      const knownTypes = byEndorser.get(record.endorser_binding_hash) ?? new Set<string>();
      knownTypes.add(record.endorsement_type);
      byEndorser.set(record.endorser_binding_hash, knownTypes);
      endorsementTypesBySubjectAndEndorser.set(record.subject_binding_hash, byEndorser);
      continue;
    }

    if (record.record_type === 'key_rotation') {
      const knownRotations = rotationsBySubject.get(record.subject_uuid) ?? [];
      knownRotations.push(record);
      rotationsBySubject.set(record.subject_uuid, knownRotations);
      continue;
    }

    if (record.record_type === 'revocation') {
      const known = revocationsByBinding.get(record.target_record_hash) ?? [];
      known.push(record);
      revocationsByBinding.set(record.target_record_hash, known);
    }
  }

  const activeBindingBySubject = new Map<string, string>();

  for (const [subjectUuid, bindingHashes] of bindingsBySubject.entries()) {
    const active = determineActiveBindingForSubject(bindingHashes, rotationsBySubject.get(subjectUuid) ?? []);
    if (active) {
      activeBindingBySubject.set(subjectUuid, active);
    }

    if (bindingHashes.length < 2) {
      continue;
    }

    if (!active) {
      const sorted = [...bindingHashes].sort();
      for (const bindingHash of sorted) {
        conflictsByBinding.set(bindingHash, new Set(sorted.filter((hash) => hash !== bindingHash)));
      }
    }
  }

  for (const [bindingHash, byEndorser] of endorsementTypesBySubjectAndEndorser.entries()) {
    const hasContradiction = [...byEndorser.values()].some((types) => types.has('binding_valid') && types.has('binding_invalid'));
    if (!hasContradiction) {
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
    activeBindingBySubject,
  };
}
