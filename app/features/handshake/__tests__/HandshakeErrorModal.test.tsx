import { fireEvent, render } from '@testing-library/react-native';

import { HandshakeErrorModal } from '@/app/features/handshake/components/HandshakeErrorModal';
import type { ProximityDiagnosticEvent } from '@/app/features/proximity/useProximityBootstrap';

const EVENTS: ProximityDiagnosticEvent[] = [
  {
    at: '2026-03-18T10:00:00.000Z',
    source: 'qr',
    action: 'scan_start',
    detail: 'QR payload scanned; decoding and validating.',
  },
  {
    at: '2026-03-18T10:00:01.000Z',
    source: 'qr',
    action: 'scan_invalid',
    detail: 'invalid_signature:signature',
  },
];

describe('HandshakeErrorModal', () => {
  it('renders failure summary and complete diagnostic timeline with reset action', () => {
    const onResetRetry = jest.fn();
    const { getByText } = render(
      <HandshakeErrorModal
        visible
        failureReason="invalid_signature:signature"
        mappedMessage="Bootstrap signature is invalid."
        diagnostic="Bootstrap validation failed: invalid_signature:signature"
        diagnosticEvents={EVENTS}
        onResetRetry={onResetRetry}
      />
    );

    expect(getByText('Handshake Error')).toBeTruthy();
    expect(getByText('Failure Reason: invalid_signature:signature')).toBeTruthy();
    expect(getByText('Bootstrap signature is invalid.')).toBeTruthy();
    expect(getByText('Bootstrap validation failed: invalid_signature:signature')).toBeTruthy();
    expect(getByText('2026-03-18T10:00:00.000Z [qr] scan_start: QR payload scanned; decoding and validating.')).toBeTruthy();
    expect(getByText('2026-03-18T10:00:01.000Z [qr] scan_invalid: invalid_signature:signature')).toBeTruthy();

    fireEvent.press(getByText('Reset and Retry'));
    expect(onResetRetry).toHaveBeenCalledTimes(1);
  });
});
