export type BootstrapSessionStatus =
  | 'idle'
  | 'nfc_preparing'
  | 'nfc_ready'
  | 'nfc_received'
  | 'bootstrap_validated'
  | 'ble_advertising'
  | 'ble_scanning'
  | 'ble_connecting'
  | 'ble_connected'
  | 'session_authenticating'
  | 'session_authenticated'
  | 'failed';

export interface ProximitySessionState {
  status: BootstrapSessionStatus;
  failureReason?: string;
}

export type ProximitySessionAction =
  | { type: 'set_status'; status: BootstrapSessionStatus }
  | { type: 'failed'; reason: string }
  | { type: 'reset' };

export function proximitySessionReducer(
  state: ProximitySessionState,
  action: ProximitySessionAction
): ProximitySessionState {
  switch (action.type) {
    case 'set_status':
      return {
        status: action.status,
        failureReason: action.status === 'failed' ? state.failureReason : undefined,
      };
    case 'failed':
      return {
        status: 'failed',
        failureReason: action.reason,
      };
    case 'reset':
      return { status: 'idle', failureReason: undefined };
    default:
      return state;
  }
}
