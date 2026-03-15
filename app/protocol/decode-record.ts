import type { ZodIssue } from 'zod';

import type { DurableRecord } from './records';
import {
  getSupportedRecordVersions,
  hasSupportedRecordVersion,
  isDurableRecordType,
  isWellFormedRecordVersion,
  resolveRecordParser,
} from './versions';

export type DurableRecordDecodeErrorCode =
  | 'unknown_record_type'
  | 'missing_record_version'
  | 'malformed_record_version'
  | 'unsupported_record_version'
  | 'schema_parse_failure';

export type DurableRecordDecodeFailure = {
  ok: false;
  code: DurableRecordDecodeErrorCode;
  recordType?: unknown;
  recordVersion?: unknown;
  message: string;
  issues?: ZodIssue[];
};

export type DurableRecordDecodeSuccess = {
  ok: true;
  record: DurableRecord;
};

export type DurableRecordDecodeResult = DurableRecordDecodeSuccess | DurableRecordDecodeFailure;

export type DecodeDurableRecordOptions = {
  onSchemaParseAttempt?: () => void;
};

function asPlainObject(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

export function decodeDurableRecord(
  input: unknown,
  options: DecodeDurableRecordOptions = {}
): DurableRecordDecodeResult {
  const payload = asPlainObject(input);
  const recordType = payload.record_type;

  if (!isDurableRecordType(recordType)) {
    return {
      ok: false,
      code: 'unknown_record_type',
      recordType,
      message: 'record_type is unknown or unsupported',
    };
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'record_version')) {
    return {
      ok: false,
      code: 'missing_record_version',
      recordType,
      message: 'record_version is required',
    };
  }

  const recordVersion = payload.record_version;

  if (!isWellFormedRecordVersion(recordVersion)) {
    return {
      ok: false,
      code: 'malformed_record_version',
      recordType,
      recordVersion,
      message: 'record_version must be an integer >= 1',
    };
  }

  if (!hasSupportedRecordVersion(recordType, recordVersion)) {
    return {
      ok: false,
      code: 'unsupported_record_version',
      recordType,
      recordVersion,
      message: `record_version ${recordVersion} is not supported for ${recordType}`,
    };
  }

  const parser = resolveRecordParser(recordType, recordVersion);

  if (!parser) {
    return {
      ok: false,
      code: 'unsupported_record_version',
      recordType,
      recordVersion,
      message: `no parser registered for ${recordType}@v${recordVersion}; supported versions: ${getSupportedRecordVersions(recordType).join(', ')}`,
    };
  }

  options.onSchemaParseAttempt?.();
  const parsed = parser.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      code: 'schema_parse_failure',
      recordType,
      recordVersion,
      message: 'record payload failed schema parsing',
      issues: parsed.error.issues as ZodIssue[],
    };
  }

  return {
    ok: true,
    record: parsed.data,
  };
}
