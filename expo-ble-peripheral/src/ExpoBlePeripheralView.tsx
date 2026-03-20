import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoBlePeripheralViewProps } from './ExpoBlePeripheral.types';

const NativeView: React.ComponentType<ExpoBlePeripheralViewProps> =
  requireNativeView('ExpoBlePeripheral');

export default function ExpoBlePeripheralView(props: ExpoBlePeripheralViewProps) {
  return <NativeView {...props} />;
}
