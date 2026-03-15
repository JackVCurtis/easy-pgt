import { isValidHash, isValidPublicKey, isValidSignature, isValidUUID } from '../formatValidators';
import { VALIDATION_LIMITS } from '../validationLimits';
import type { StructuralRecord, StructuralValidationResult } from '../validationTypes';
import { enforceObject, enforceStringMaxSize, invalid, requireFields } from './shared';

const REQUIRED_FIELDS = [
  'record_type',
  'record_version',
  'handshake_uuid',
  'participant_a_binding_hash',
  'participant_b_binding_hash',
  'participant_a_merkle_root',
  'participant_b_merkle_root',
  'ephemeral_keys',
  'signatures',
] as const;

export function validateHandshakeStructure(record: StructuralRecord): StructuralValidationResult {
  const missingField = requireFields(record, REQUIRED_FIELDS);
  if (missingField) return missingField;

  if (!isValidUUID(record.handshake_uuid)) return invalid('invalid_format', 'handshake_uuid');
  if (!isValidHash(record.participant_a_binding_hash)) return invalid('invalid_format', 'participant_a_binding_hash');
  if (!isValidHash(record.participant_b_binding_hash)) return invalid('invalid_format', 'participant_b_binding_hash');
  if (!isValidHash(record.participant_a_merkle_root)) return invalid('invalid_format', 'participant_a_merkle_root');
  if (!isValidHash(record.participant_b_merkle_root)) return invalid('invalid_format', 'participant_b_merkle_root');

  const keyObjValidation = enforceObject(record.ephemeral_keys, 'ephemeral_keys');
  if (keyObjValidation) return keyObjValidation;
  const signatureObjValidation = enforceObject(record.signatures, 'signatures');
  if (signatureObjValidation) return signatureObjValidation;

  const keyRecord = record.ephemeral_keys as StructuralRecord;
  const sigRecord = record.signatures as StructuralRecord;

  const missingKey = requireFields(keyRecord, ['participant_a', 'participant_b']);
  if (missingKey) return invalid(missingKey.reason, `ephemeral_keys.${missingKey.field}`);
  const missingSignature = requireFields(sigRecord, ['participant_a', 'participant_b']);
  if (missingSignature) return invalid(missingSignature.reason, `signatures.${missingSignature.field}`);

  if (!isValidPublicKey(keyRecord.participant_a)) return invalid('invalid_format', 'ephemeral_keys.participant_a');
  if (!isValidPublicKey(keyRecord.participant_b)) return invalid('invalid_format', 'ephemeral_keys.participant_b');
  if (!isValidSignature(sigRecord.participant_a)) return invalid('invalid_format', 'signatures.participant_a');
  if (!isValidSignature(sigRecord.participant_b)) return invalid('invalid_format', 'signatures.participant_b');

  const keyASize = enforceStringMaxSize(
    keyRecord.participant_a,
    'ephemeral_keys.participant_a',
    VALIDATION_LIMITS.max_public_key_size
  );
  if (keyASize) return keyASize;
  const keyBSize = enforceStringMaxSize(
    keyRecord.participant_b,
    'ephemeral_keys.participant_b',
    VALIDATION_LIMITS.max_public_key_size
  );
  if (keyBSize) return keyBSize;

  const sigASize = enforceStringMaxSize(sigRecord.participant_a, 'signatures.participant_a', VALIDATION_LIMITS.max_signature_size);
  if (sigASize) return sigASize;
  const sigBSize = enforceStringMaxSize(sigRecord.participant_b, 'signatures.participant_b', VALIDATION_LIMITS.max_signature_size);
  if (sigBSize) return sigBSize;

  return { valid: true };
}
