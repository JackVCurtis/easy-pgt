export interface NfcBootstrapV1 {
  version: 1;
  session_uuid: string;
  identity_binding_hash: string;
  ephemeral_public_key: string;
  bluetooth_service_uuid: string;
  nonce: string;
  signature: string;
}

export type SignableNfcBootstrapV1 = Omit<NfcBootstrapV1, 'signature'>;

export type NfcBootstrapValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason:
        | 'missing_field'
        | 'invalid_format'
        | 'invalid_version'
        | 'field_too_large'
        | 'invalid_signature'
        | 'signature_decode_failed'
        | 'public_key_decode_failed'
        | 'validation_failure';
      field: string;
    };

export type DecodedNfcBootstrapResult =
  | {
      valid: true;
      payload: NfcBootstrapV1;
    }
  | NfcBootstrapValidationResult;
