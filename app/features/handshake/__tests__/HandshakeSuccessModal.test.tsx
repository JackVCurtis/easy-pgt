import { fireEvent, render } from '@testing-library/react-native';

import { HandshakeSuccessModal } from '@/app/features/handshake/components/HandshakeSuccessModal';
import {
  ACCEPTER_MOCK_CONTACT_PAYLOAD,
  OFFERER_MOCK_CONTACT_PAYLOAD,
} from '@/app/features/handshake/handshakePayloads';

describe('HandshakeSuccessModal', () => {
  it('renders exchanged payload JSON and allows closing', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <HandshakeSuccessModal
        visible
        onClose={onClose}
        exchangedPayload={{
          localSharedPayload: OFFERER_MOCK_CONTACT_PAYLOAD,
          remoteReceivedPayload: ACCEPTER_MOCK_CONTACT_PAYLOAD,
        }}
      />
    );

    expect(getByText('Handshake Success')).toBeTruthy();
    expect(getByText(/"displayName":\s+"Alex Offer"/)).toBeTruthy();
    expect(getByText(/"displayName":\s+"Blair Accept"/)).toBeTruthy();

    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
