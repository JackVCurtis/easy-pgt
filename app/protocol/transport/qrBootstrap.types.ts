export interface QrBootstrapV1 {
  version: 1;
  session_uuid: string;
  identity_binding_hash: string;
  ephemeral_public_key: string;
  bluetooth_service_uuid: string;
  nonce: string;
  signature: string;
}

export type SignableQrBootstrapV1 = Omit<QrBootstrapV1, 'signature'>;

export type QrBootstrapValidationError = {
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

export type QrBootstrapValidationResult = { valid: true } | QrBootstrapValidationError;

export type DecodedQrBootstrapResult =
  | {
      valid: true;
      payload: QrBootstrapV1;
    }
  | QrBootstrapValidationError;
