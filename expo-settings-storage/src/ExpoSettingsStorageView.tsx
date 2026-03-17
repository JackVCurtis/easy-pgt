import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoSettingsStorageViewProps } from './ExpoSettingsStorage.types';

const NativeView: React.ComponentType<ExpoSettingsStorageViewProps> =
  requireNativeView('ExpoSettingsStorage');

export default function ExpoSettingsStorageView(props: ExpoSettingsStorageViewProps) {
  return <NativeView {...props} />;
}
