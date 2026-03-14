import { TRUST_FLOWS } from '@/app/navigation/flows';

describe('TRUST_FLOWS', () => {
  it('defines the three trust flows as tab entries including counterparties and messages', () => {
    expect(TRUST_FLOWS.map((flow) => flow.routeName)).toEqual([
      'handshake',
      'counterparties',
      'messages',
    ]);
  });

  it('defines expected stack screens for each flow', () => {
    const flowToScreens = Object.fromEntries(
      TRUST_FLOWS.map((flow) => [flow.routeName, flow.stackScreens])
    );

    expect(flowToScreens.handshake).toEqual(['index']);
    expect(flowToScreens.counterparties).toEqual(['index', '[id]']);
    expect(flowToScreens.messages).toEqual(['index']);
  });
});
