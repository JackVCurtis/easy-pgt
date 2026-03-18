import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HandshakeContainer } from '@/app/features/handshake/HandshakeContainer';
import type { ProximitySessionState } from '@/app/features/proximity/proximityState';
import { useProximityBootstrap, type ProximityDiagnosticEvent } from '@/app/features/proximity/useProximityBootstrap';

jest.mock('@/app/features/proximity/useProximityBootstrap');

jest.mock('@/app/features/proximity/components/ProximityQrDisplay', () => ({
  ProximityQrDisplay: () => null,
}));

jest.mock('@/app/features/proximity/components/ProximityQrScanner', () => ({
  ProximityQrScanner: () => null,
}));

const mockedUseProximityBootstrap = jest.mocked(useProximityBootstrap);

describe('HandshakeContainer', () => {
  it('opens error modal on failed status and reset/retry returns to two-button pre-init state', async () => {
    const reset = jest.fn().mockResolvedValue(undefined);
    const prepareWriterPayload = jest.fn().mockResolvedValue(undefined);

    const diagnosticEvents: ProximityDiagnosticEvent[] = [
      {
        at: '2026-03-18T10:00:01.000Z',
        source: 'qr',
        action: 'scan_invalid',
        detail: 'invalid_signature:signature',
      },
    ];

    let state: ProximitySessionState = { status: 'bootstrap_ready', failureReason: undefined };

    mockedUseProximityBootstrap.mockImplementation(() => ({
      state,
      roleOptions: ['writer', 'reader'],
      bootstrapPayload: null,
      bootstrapDisplayString: 'mock-bootstrap',
      diagnostic: state.status === 'failed' ? 'Bootstrap validation failed: invalid_signature:signature' : '',
      diagnosticEvents: state.status === 'failed' ? diagnosticEvents : [],
      localSignerPublicKeyBase64: '',
      prepareWriterPayload,
      ingestScannedBootstrap: jest.fn(),
      handleCameraPermissionDenied: jest.fn(),
      startBleDiscoveryConnect: jest.fn(),
      reset,
    }));

    const { getByText, queryByText, rerender } = render(<HandshakeContainer />);

    fireEvent.press(getByText('Offer Hand'));
    expect(getByText('Have the other person scan this QR to start proximity bootstrap.')).toBeTruthy();

    state = { status: 'failed', failureReason: 'invalid_signature:signature' };
    rerender(<HandshakeContainer />);

    expect(getByText('Handshake Error')).toBeTruthy();
    expect(getByText('Bootstrap signature is invalid.')).toBeTruthy();
    expect(getByText('2026-03-18T10:00:01.000Z [qr] scan_invalid: invalid_signature:signature')).toBeTruthy();

    fireEvent.press(getByText('Reset and Retry'));

    await waitFor(() => {
      expect(reset).toHaveBeenCalledTimes(1);
      expect(getByText('Offer Hand')).toBeTruthy();
      expect(getByText('Accept Handshake')).toBeTruthy();
      expect(queryByText('Have the other person scan this QR to start proximity bootstrap.')).toBeNull();
    });
  });
});
