import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import MessagesScreen from '@/app/(tabs)/messages';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

describe('Messages screen actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs a message and copies the signed payload to clipboard', async () => {
    const { getByPlaceholderText, getByText } = render(<MessagesScreen />);

    fireEvent.changeText(getByPlaceholderText('Paste or type message content here...'), 'hello world');
    fireEvent.press(getByText('Sign + Copy to Clipboard'));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining('---SIGNATURE---'));
    });

    expect(getByText('Message signed and copied to clipboard.')).toBeTruthy();
  });

  it('reports missing signature when verifying unsigned content', () => {
    const { getByPlaceholderText, getByText } = render(<MessagesScreen />);

    fireEvent.changeText(getByPlaceholderText('Paste or type message content here...'), 'unsigned data');
    fireEvent.press(getByText('Verify Signature'));

    expect(getByText('No signature found.')).toBeTruthy();
  });
});
