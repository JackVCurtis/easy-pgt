import * as React from 'react';

import { ExpoBlePeripheralViewProps } from './ExpoBlePeripheral.types';

export default function ExpoBlePeripheralView(props: ExpoBlePeripheralViewProps) {
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
