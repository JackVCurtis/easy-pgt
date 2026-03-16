import { proximitySessionReducer, type ProximitySessionState } from '@/app/features/proximity/proximityState';

describe('proximitySessionReducer', () => {
  const initial: ProximitySessionState = {
    status: 'idle',
    failureReason: undefined,
  };

  it('transitions through success statuses deterministically', () => {
    const preparing = proximitySessionReducer(initial, { type: 'set_status', status: 'nfc_preparing' });
    const validated = proximitySessionReducer(preparing, { type: 'set_status', status: 'bootstrap_validated' });
    const authenticated = proximitySessionReducer(validated, { type: 'set_status', status: 'session_authenticated' });

    expect(authenticated).toEqual({
      status: 'session_authenticated',
      failureReason: undefined,
    });
  });

  it('captures failure reason', () => {
    expect(proximitySessionReducer(initial, { type: 'failed', reason: 'service_uuid_mismatch' })).toEqual({
      status: 'failed',
      failureReason: 'service_uuid_mismatch',
    });
  });
});
