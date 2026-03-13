import type React from 'react';

jest.mock('expo-router', () => ({
  Redirect: 'Redirect',
}));

describe('root route', () => {
  it('redirects / to the handshake tab route', () => {
    const RootIndex = require('@/app/index').default as () => React.ReactElement<{ href: string }>;

    const element = RootIndex();

    expect(element.props).toMatchObject({ href: '/handshake' });
  });
});
