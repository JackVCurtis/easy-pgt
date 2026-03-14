export type TrustFlow = {
  routeName: 'handshake' | 'counterparties' | 'messages';
  title: string;
  icon: 'person.2.fill' | 'person.crop.circle.badge.checkmark' | 'signature';
  stackScreens: string[];
};

export const TRUST_FLOWS: TrustFlow[] = [
  {
    routeName: 'handshake',
    title: 'Handshake',
    icon: 'person.2.fill',
    stackScreens: ['index'],
  },
  {
    routeName: 'counterparties',
    title: 'Counterparties',
    icon: 'person.crop.circle.badge.checkmark',
    stackScreens: ['index', '[id]'],
  },
  {
    routeName: 'messages',
    title: 'Messages',
    icon: 'signature',
    stackScreens: ['index'],
  },
];
