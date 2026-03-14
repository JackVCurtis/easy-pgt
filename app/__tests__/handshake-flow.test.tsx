import { act, fireEvent, render } from '@testing-library/react-native';

import HandshakeScreen from '@/app/(tabs)/handshake';

describe('Handshake flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('guides the user through sharing details and confirms a generated counterparty name', () => {
    const { getByText, getByPlaceholderText } = render(<HandshakeScreen />);

    fireEvent.press(getByText('Start Handshake'));

    expect(getByText('Share details for this handshake')).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('Enter the name you want to share'), 'Taylor Morgan');
    fireEvent.press(getByText('Continue to NFC exchange'));

    expect(getByText('Hold phones next to each other')).toBeTruthy();

    for (let i = 0; i < 5; i += 1) {
      act(() => {
        jest.advanceTimersByTime(800);
      });
    }

    expect(getByText('Handshake complete')).toBeTruthy();
    expect(getByText('Connected with Avery Shaw.')).toBeTruthy();
    expect(getByText('Name you shared: Taylor Morgan')).toBeTruthy();
  });
});
