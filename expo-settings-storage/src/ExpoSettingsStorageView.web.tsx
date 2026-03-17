import * as React from 'react';

import { ExpoSettingsStorageViewProps } from './ExpoSettingsStorage.types';

export default function ExpoSettingsStorageView(props: ExpoSettingsStorageViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
