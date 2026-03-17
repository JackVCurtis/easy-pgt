import { type NfcBootstrapV1 } from '@/app/protocol/transport';

import type { ProximityNfcPort } from './types';

const BOOTSTRAP_RECORD_TYPE = 'application/vnd.comrades.bootstrap+json';

interface NfcManagerLike {
  start(): Promise<void>;
  requestTechnology(tech: unknown): Promise<void>;
  cancelTechnologyRequest(): Promise<void>;
  getTag(): Promise<unknown>;
  ndefHandler: {
    writeNdefMessage(bytes: number[]): Promise<void>;
  };
}

interface NdefLike {
  TNF_MIME_MEDIA: number;
  record(tnf: number, type: string, id: number[], payload: string): unknown;
  encodeMessage(records: unknown[]): number[] | null;
}

interface NfcTechLike {
  Ndef: unknown;
}

interface CreateNfcAdapterOptions {
  requestDeadlineMs?: number;
}

const DEFAULT_NFC_REQUEST_DEADLINE_MS = 12_000;

function getNfcDependencies(): {
  NfcManager: NfcManagerLike;
  Ndef: NdefLike;
  NfcTech: NfcTechLike;
} | null {
  try {
    // Defer requiring native modules until runtime so Jest environments without
    // NativeEventEmitter support can still import this file safely.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nfcModule = require('react-native-nfc-manager');

    return {
      NfcManager: nfcModule.default as NfcManagerLike,
      Ndef: nfcModule.Ndef as NdefLike,
      NfcTech: nfcModule.NfcTech as NfcTechLike,
    };
  } catch {
    return null;
  }
}

function decodeTextRecordPayload(payloadBytes: number[] | Uint8Array): string {
  const payload = payloadBytes instanceof Uint8Array ? payloadBytes : Uint8Array.from(payloadBytes);
  if (payload.length === 0) {
    return '';
  }

  const languageCodeLength = payload[0] & 0x3f;
  return String.fromCharCode(...payload.slice(1 + languageCodeLength));
}

function encodeBootstrapPayload(payload: NfcBootstrapV1, ndef: NdefLike): number[] {
  const jsonPayload = JSON.stringify(payload);
  const record = ndef.record(
    ndef.TNF_MIME_MEDIA,
    BOOTSTRAP_RECORD_TYPE,
    [],
    jsonPayload,
  );

  const encoded = ndef.encodeMessage([record]);
  if (!encoded) {
    throw new Error('NFC_ENCODE_FAILED');
  }

  return encoded;
}

function parseBootstrapFromTag(tag: unknown): NfcBootstrapV1 | null {
  const records = (tag as { ndefMessage?: Array<{ payload?: number[] | Uint8Array }> })?.ndefMessage;
  if (!records || records.length === 0) {
    return null;
  }

  for (const record of records) {
    if (!record.payload) {
      continue;
    }

    try {
      const text = decodeTextRecordPayload(record.payload);
      const parsed = JSON.parse(text);
      return parsed as NfcBootstrapV1;
    } catch {
      continue;
    }
  }

  return null;
}

export function createNfcAdapter(options: CreateNfcAdapterOptions = {}): ProximityNfcPort {
  const dependencies = getNfcDependencies();
  const requestDeadlineMs = options.requestDeadlineMs ?? DEFAULT_NFC_REQUEST_DEADLINE_MS;

  if (!dependencies) {
    return {
      async writeBootstrapPayload() {
        throw new Error('NFC_UNAVAILABLE_OR_DISABLED');
      },
      async readBootstrapPayload() {
        throw new Error('NFC_UNAVAILABLE_OR_DISABLED');
      },
      async cancel() {
        return;
      },
      async cleanup() {
        return;
      },
    };
  }

  const { NfcManager, Ndef, NfcTech } = dependencies;
  let started = false;

  const ensureStarted = async () => {
    if (!started) {
      await NfcManager.start();
      started = true;
    }
  };

  const runWithRequestTimeout = async <T>(operation: () => Promise<T>): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('NFC_REQUEST_TIMEOUT'));
          }, requestDeadlineMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const requestNdefTechnology = async () => {
    try {
      await runWithRequestTimeout(() => NfcManager.requestTechnology(NfcTech.Ndef));
    } catch (error) {
      if (error instanceof Error && error.message === 'NFC_REQUEST_TIMEOUT') {
        await NfcManager.cancelTechnologyRequest().catch(() => undefined);
      }
      throw error;
    }
  };

  const getTagWithTimeout = async () => {
    try {
      return await runWithRequestTimeout(() => NfcManager.getTag());
    } catch (error) {
      if (error instanceof Error && error.message === 'NFC_REQUEST_TIMEOUT') {
        await NfcManager.cancelTechnologyRequest().catch(() => undefined);
      }
      throw error;
    }
  };

  return {
    async writeBootstrapPayload(payload) {
      await ensureStarted();
      await requestNdefTechnology();
      await NfcManager.ndefHandler.writeNdefMessage(encodeBootstrapPayload(payload, Ndef));
      await NfcManager.cancelTechnologyRequest();
    },
    async readBootstrapPayload() {
      await ensureStarted();
      await requestNdefTechnology();
      const tag = await getTagWithTimeout();
      await NfcManager.cancelTechnologyRequest();
      return parseBootstrapFromTag(tag);
    },
    async cancel() {
      await NfcManager.cancelTechnologyRequest();
    },
    async cleanup() {
      await NfcManager.cancelTechnologyRequest();
    },
  };
}
