import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

import { type NfcBootstrapV1 } from '@/app/protocol/transport';

import type { ProximityNfcPort } from './types';

const BOOTSTRAP_RECORD_TYPE = 'application/vnd.easy-pgt.bootstrap+json';

function decodeTextRecordPayload(payloadBytes: number[] | Uint8Array): string {
  const payload = payloadBytes instanceof Uint8Array ? payloadBytes : Uint8Array.from(payloadBytes);
  if (payload.length === 0) {
    return '';
  }

  const languageCodeLength = payload[0] & 0x3f;
  return String.fromCharCode(...payload.slice(1 + languageCodeLength));
}

function encodeBootstrapPayload(payload: NfcBootstrapV1): number[] {
  const jsonPayload = JSON.stringify(payload);
  const record = Ndef.record(
    Ndef.TNF_MIME_MEDIA,
    BOOTSTRAP_RECORD_TYPE,
    [],
    jsonPayload,
  );

  const encoded = Ndef.encodeMessage([record]);
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

export function createNfcAdapter(): ProximityNfcPort {
  let started = false;

  const ensureStarted = async () => {
    if (!started) {
      await NfcManager.start();
      started = true;
    }
  };

  return {
    async writeBootstrapPayload(payload) {
      await ensureStarted();
      await NfcManager.requestTechnology(NfcTech.Ndef);
      await NfcManager.ndefHandler.writeNdefMessage(encodeBootstrapPayload(payload));
      await NfcManager.cancelTechnologyRequest();
    },
    async readBootstrapPayload() {
      await ensureStarted();
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
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
