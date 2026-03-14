import { render } from '@testing-library/react-native';

import HandshakeScreen from '@/app/(tabs)/handshake';
import MessageDistanceScreen from '@/app/(tabs)/message-distance';
import SignMessageScreen from '@/app/(tabs)/sign-message';

describe('Screen-level mock data views', () => {
  it('shows handshake start state and routes counterparties to a dedicated screen', () => {
    const { getByText } = render(<HandshakeScreen />);

    expect(getByText('Handshake')).toBeTruthy();
    expect(getByText('Start Handshake')).toBeTruthy();
    expect(getByText('Open Counterparties')).toBeTruthy();
  });

  it('shows signed message records in the sign-message flow', () => {
    const { getByText } = render(<SignMessageScreen />);

    expect(getByText('Signed Messages')).toBeTruthy();
    expect(getByText('Release update 1.4')).toBeTruthy();
    expect(getByText('Root hash sync complete')).toBeTruthy();
  });

  it('shows profile identity details with explicit sharing notice', () => {
    const { getByText } = render(<MessageDistanceScreen />);

    expect(getByText('Profile Identity')).toBeTruthy();
    expect(getByText('Display Name')).toBeTruthy();
    expect(
      getByText(
        'Profile identity details are maintained locally and are not shared during handshake unless the counterparty user explicitly opts in.'
      )
    ).toBeTruthy();
  });
});
