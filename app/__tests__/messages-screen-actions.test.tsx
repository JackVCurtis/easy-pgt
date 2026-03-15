import { fireEvent, render, waitFor } from '@testing-library/react-native';

import MessagesScreen from '@/app/(tabs)/messages';
import { Colors } from '@/constants/theme';

const mockUseColorScheme = jest.fn<ReturnType<() => 'light' | 'dark' | null>, []>();

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => mockUseColorScheme(),
}));

describe('Messages screen actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
  });

  it('uses high-contrast input colors in dark mode', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { getByPlaceholderText } = render(<MessagesScreen />);
    const input = getByPlaceholderText('Paste or type message content here...');

    expect(input.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: Colors.dark.text,
          backgroundColor: Colors.dark.surface,
          borderColor: Colors.dark.border,
        }),
      ])
    );
    expect(input.props.placeholderTextColor).toBe(Colors.dark.textMuted);
  });

  it('uses high-contrast input colors in light mode', () => {
    const { getByPlaceholderText } = render(<MessagesScreen />);
    const input = getByPlaceholderText('Paste or type message content here...');

    expect(input.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: Colors.light.text,
          backgroundColor: Colors.light.surface,
          borderColor: Colors.light.border,
        }),
      ])
    );
    expect(input.props.placeholderTextColor).toBe(Colors.light.textMuted);
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
    expect(getByText('Sender distance from local connections')).toBeTruthy();
    expect(getByText('• Northside Organizer: 1 hop(s)')).toBeTruthy();
    expect(getByText('• Library Contact: 2 hop(s)')).toBeTruthy();
    expect(getByText('• Mutual Friend: 3 hop(s)')).toBeTruthy();
  });
});
