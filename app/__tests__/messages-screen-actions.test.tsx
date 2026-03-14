import { fireEvent, render, waitFor } from '@testing-library/react-native';

import MessagesScreen from '@/app/(tabs)/messages';

describe('Messages screen actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs a message and copies the signed payload to clipboard', async () => {
    const { getByPlaceholderText, getByText } = render(<MessagesScreen />);

    fireEvent.changeText(getByPlaceholderText('Paste or type message content here...'), 'hello world');
    fireEvent.press(getByText('Sign + Copy to Clipboard'));

    await waitFor(() => {
      expect(getByPlaceholderText('Paste or type message content here...').props.value).toContain(
        '---SIGNATURE---'
      );
    });

    expect(getByText('Message signed and copied to clipboard (mock).')).toBeTruthy();
  });

  it('reports missing signature when verifying unsigned content', () => {
    const { getByPlaceholderText, getByText } = render(<MessagesScreen />);

    fireEvent.changeText(getByPlaceholderText('Paste or type message content here...'), 'unsigned data');
    fireEvent.press(getByText('Verify Message'));

    expect(getByText('No signature found.')).toBeTruthy();
    expect(getByText('Sender distance from local counterparties')).toBeTruthy();
    expect(getByText('• Northside Organizer: 1 hop(s)')).toBeTruthy();
    expect(getByText('• Library Contact: 2 hop(s)')).toBeTruthy();
    expect(getByText('• Mutual Friend: 3 hop(s)')).toBeTruthy();
  });
});
