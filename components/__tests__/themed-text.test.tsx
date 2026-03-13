import { render } from '@testing-library/react-native';

import { ThemedText } from '@/components/themed-text';

describe('ThemedText', () => {
  it('renders children content', () => {
    const { getByText } = render(<ThemedText>Easy PGT</ThemedText>);

    expect(getByText('Easy PGT')).toBeTruthy();
  });
});
