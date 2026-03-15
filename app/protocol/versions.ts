import {
  endorsementSchema,
  handshakeSchema,
  identityBindingSchema,
  keyRotationSchema,
  revocationSchema,
  type DurableRecord,
} from './records';

export const durableRecordTypes = [
  'identity_binding',
  'endorsement',
  'handshake',
  'key_rotation',
  'revocation',
] as const;

export type DurableRecordType = (typeof durableRecordTypes)[number];

export type SupportedRecordVersion = number;

type DurableRecordParser = {
  safeParse: (input: unknown) =>
    | { success: true; data: DurableRecord }
    | { success: false; error: { issues: unknown[] } };
};

type VersionParserRegistry = Record<DurableRecordType, Record<SupportedRecordVersion, DurableRecordParser>>;

const parserRegistry: VersionParserRegistry = {
  identity_binding: {
    1: identityBindingSchema,
  },
  endorsement: {
    1: endorsementSchema,
  },
  handshake: {
    1: handshakeSchema,
  },
  key_rotation: {
    1: keyRotationSchema,
  },
  revocation: {
    1: revocationSchema,
  },
};

export const supportedRecordVersions: Record<DurableRecordType, readonly SupportedRecordVersion[]> = {
  identity_binding: [1],
  endorsement: [1],
  handshake: [1],
  key_rotation: [1],
  revocation: [1],
};

export function isDurableRecordType(value: unknown): value is DurableRecordType {
  return typeof value === 'string' && durableRecordTypes.includes(value as DurableRecordType);
}

export function hasSupportedRecordVersion(recordType: DurableRecordType, version: SupportedRecordVersion): boolean {
  return supportedRecordVersions[recordType].includes(version);
}

export function getSupportedRecordVersions(recordType: DurableRecordType): readonly SupportedRecordVersion[] {
  return supportedRecordVersions[recordType];
}

export function isWellFormedRecordVersion(version: unknown): version is SupportedRecordVersion {
  return typeof version === 'number' && Number.isInteger(version) && Number.isFinite(version) && version >= 1;
}

export function resolveRecordParser(recordType: DurableRecordType, version: SupportedRecordVersion): DurableRecordParser | null {
  return parserRegistry[recordType][version] ?? null;
}
