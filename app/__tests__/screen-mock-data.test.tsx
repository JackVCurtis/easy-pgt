import { render } from '@testing-library/react-native';

import HandshakeScreen from '@/app/(tabs)/handshake';
import MessagesScreen from '@/app/(tabs)/messages';

describe('Screen-level mock data views', () => {
  it('shows handshake start state and routes counterparties to a dedicated screen', () => {
    const { getByText } = render(<HandshakeScreen />);

    expect(getByText('Handshake')).toBeTruthy();
    expect(getByText('Start Handshake')).toBeTruthy();
    expect(getByText('Open Counterparties')).toBeTruthy();
  });

  it('shows the combined messages workflow controls and multiline input', () => {
    const { getByText, getByPlaceholderText } = render(<MessagesScreen />);

    expect(getByText('Messages')).toBeTruthy();
    expect(getByText('Verify Message')).toBeTruthy();
    expect(getByText('Sign + Copy to Clipboard')).toBeTruthy();
    expect(getByPlaceholderText('Paste or type message content here...')).toBeTruthy();
  });
});
