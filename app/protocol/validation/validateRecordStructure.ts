import { hasSupportedRecordVersion, isDurableRecordType } from '../versions';
import type { StructuralRecord, StructuralValidationResult } from './validationTypes';
import { VALIDATION_LIMITS } from './validationLimits';
import { validateEndorsementStructure } from './validators/endorsementValidator';
import { validateHandshakeStructure } from './validators/handshakeValidator';
import { validateIdentityBindingStructure } from './validators/identityBindingValidator';
import { validateKeyRotationStructure } from './validators/keyRotationValidator';
import { validateRevocationStructure } from './validators/revocationValidator';

function invalid(reason: StructuralValidationResult['reason'], field?: string): StructuralValidationResult {
  return field ? { valid: false, reason, field } : { valid: false, reason };
}

function asObject(input: unknown): StructuralRecord | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return null;
  }

  return input as StructuralRecord;
}

function exceedsRecordSize(record: StructuralRecord): boolean {
  const size = Buffer.byteLength(JSON.stringify(record), 'utf8');
  return size > VALIDATION_LIMITS.max_record_size;
}

export function validateRecordStructure(record: unknown): StructuralValidationResult {
  const candidate = asObject(record);

  if (!candidate) {
    return invalid('invalid_format');
  }

  if (!Object.prototype.hasOwnProperty.call(candidate, 'record_type')) {
    return invalid('missing_field', 'record_type');
  }

  if (!isDurableRecordType(candidate.record_type)) {
    return invalid('unknown_record_type', 'record_type');
  }

  if (!Object.prototype.hasOwnProperty.call(candidate, 'record_version')) {
    return invalid('missing_field', 'record_version');
  }

  const recordVersion = candidate.record_version;
  if (typeof recordVersion !== 'number' || !Number.isInteger(recordVersion) || recordVersion < 1) {
    return invalid('invalid_version', 'record_version');
  }

  if (!hasSupportedRecordVersion(candidate.record_type, recordVersion)) {
    return invalid('invalid_version', 'record_version');
  }

  if (exceedsRecordSize(candidate)) {
    return invalid('field_too_large', 'record');
  }

  switch (candidate.record_type) {
    case 'identity_binding':
      return validateIdentityBindingStructure(candidate);
    case 'endorsement':
      return validateEndorsementStructure(candidate);
    case 'handshake':
      return validateHandshakeStructure(candidate);
    case 'key_rotation':
      return validateKeyRotationStructure(candidate);
    case 'revocation':
      return validateRevocationStructure(candidate);
    default:
      return invalid('unknown_record_type', 'record_type');
  }
}
