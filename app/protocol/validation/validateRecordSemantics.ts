import type { DurableRecord } from '../records';

export type ValidationResult = 'accepted' | 'rejected' | 'conflicted';

export type SemanticValidationReason =
  | 'duplicate_record'
  | 'conflicting_identity_binding'
  | 'conflicting_revocation'
  | 'rotation_old_key_mismatch'
  | 'rotation_counter_not_monotonic'
  | 'rotation_reuses_historical_key';

export type SemanticValidationOutcome =
  | { result: 'accepted' }
  | {
      result: Exclude<ValidationResult, 'accepted'>;
      reason: SemanticValidationReason;
    };

export type SemanticLocalLogState = {
  knownRecordHashes?: Iterable<string>;
  identityBindingsBySubjectUuid?: Record<string, Iterable<string>>;
  revocationsBySignerAndTarget?: Record<string, Iterable<string>>;
  activeBindingHashBySubjectUuid?: Record<string, string>;
  lastRotationCounterBySubjectUuid?: Record<string, number>;
  usedBindingHashesBySubjectUuid?: Record<string, Iterable<string>>;
};

export type SemanticValidationContext = {
  candidateRecordHash?: string;
  localLogState?: SemanticLocalLogState;
};

function asSet(values?: Iterable<string>): Set<string> {
  return new Set(values ?? []);
}

function validateDuplicateRecord(
  context: SemanticValidationContext
): SemanticValidationOutcome | undefined {
  const candidateHash = context.candidateRecordHash;
  if (!candidateHash) {
    return undefined;
  }

  const knownHashes = asSet(context.localLogState?.knownRecordHashes);
  return knownHashes.has(candidateHash)
    ? { result: 'rejected', reason: 'duplicate_record' }
    : undefined;
}

function validateConflictingIdentityBinding(
  record: DurableRecord,
  context: SemanticValidationContext
): SemanticValidationOutcome | undefined {
  if (record.record_type !== 'identity_binding') {
    return undefined;
  }

  const existingKeys = asSet(
    context.localLogState?.identityBindingsBySubjectUuid?.[record.subject_uuid]
  );

  if (existingKeys.size === 0 || existingKeys.has(record.subject_identity_public_key)) {
    return undefined;
  }

  return { result: 'conflicted', reason: 'conflicting_identity_binding' };
}

function validateConflictingRevocation(
  record: DurableRecord,
  context: SemanticValidationContext
): SemanticValidationOutcome | undefined {
  if (record.record_type !== 'revocation') {
    return undefined;
  }

  const revocationKey = `${record.signer_binding_hash}::${record.target_record_hash}`;
  const existingReasons = asSet(context.localLogState?.revocationsBySignerAndTarget?.[revocationKey]);

  if (existingReasons.size === 0 || existingReasons.has(record.reason_code)) {
    return undefined;
  }

  return { result: 'conflicted', reason: 'conflicting_revocation' };
}

function validateRotationMonotonicity(
  record: DurableRecord,
  context: SemanticValidationContext
): SemanticValidationOutcome | undefined {
  if (record.record_type !== 'key_rotation') {
    return undefined;
  }

  const activeBinding = context.localLogState?.activeBindingHashBySubjectUuid?.[record.subject_uuid];
  if (activeBinding && activeBinding !== record.old_binding_hash) {
    return { result: 'rejected', reason: 'rotation_old_key_mismatch' };
  }

  const previousCounter = context.localLogState?.lastRotationCounterBySubjectUuid?.[record.subject_uuid];
  if (typeof previousCounter === 'number' && record.rotation_counter !== previousCounter + 1) {
    return { result: 'rejected', reason: 'rotation_counter_not_monotonic' };
  }

  const usedKeys = asSet(context.localLogState?.usedBindingHashesBySubjectUuid?.[record.subject_uuid]);
  if (usedKeys.has(record.new_binding_hash)) {
    return { result: 'rejected', reason: 'rotation_reuses_historical_key' };
  }

  return undefined;
}

export function validateRecordSemantics(
  record: DurableRecord,
  context: SemanticValidationContext = {}
): SemanticValidationOutcome {
  return (
    validateDuplicateRecord(context) ??
    validateConflictingIdentityBinding(record, context) ??
    validateConflictingRevocation(record, context) ??
    validateRotationMonotonicity(record, context) ??
    { result: 'accepted' }
  );
}
