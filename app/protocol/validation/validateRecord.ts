import { decodeDurableRecord } from '../decode-record';
import type { DurableRecord } from '../records';
import { validateRecordStructure } from './validateRecordStructure';
import {
  type CryptographicValidationContext,
  validateRecordCryptography,
} from './validateRecordCryptography';
import {
  type SemanticValidationContext,
  validateRecordSemantics,
} from './validateRecordSemantics';

export type RecordValidationResult =
  | { accepted: true }
  | {
      accepted: false;
      phase: 'structural' | 'cryptographic' | 'semantic';
      reason: string;
      field?: string;
      result?: 'rejected' | 'conflicted';
    };

function validateCryptography(
  record: DurableRecord,
  context: CryptographicValidationContext
): RecordValidationResult {
  const cryptoResult = validateRecordCryptography(record, context);
  if (cryptoResult.valid) {
    return { accepted: true };
  }

  return {
    accepted: false,
    phase: 'cryptographic',
    reason: cryptoResult.reason,
    field: cryptoResult.field,
  };
}

export type RecordValidationContext = CryptographicValidationContext & {
  semantic?: SemanticValidationContext;
};

export function validateRecord(
  record: unknown,
  context: RecordValidationContext = {}
): RecordValidationResult {
  const structureResult = validateRecordStructure(record);
  if (!structureResult.valid) {
    return {
      accepted: false,
      phase: 'structural',
      reason: structureResult.reason,
      field: structureResult.field,
    };
  }

  const decoded = decodeDurableRecord(record);
  if (!decoded.ok) {
    return {
      accepted: false,
      phase: 'structural',
      reason: decoded.code,
    };
  }


  const cryptographicResult = validateCryptography(decoded.record, context);
  if (!cryptographicResult.accepted) {
    return cryptographicResult;
  }

  const semanticResult = validateRecordSemantics(decoded.record, context.semantic);
  if (semanticResult.result !== 'accepted') {
    return {
      accepted: false,
      phase: 'semantic',
      reason: semanticResult.reason,
      result: semanticResult.result,
    };
  }

  return cryptographicResult;
}
