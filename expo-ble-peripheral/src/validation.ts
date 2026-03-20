import type { StartPeripheralOptions } from './ExpoBlePeripheral.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateStartPeripheralOptions(options: StartPeripheralOptions): void {
  if (!UUID_PATTERN.test(options.serviceUuid)) {
    throw new Error('ERR_INVALID_OPTIONS: serviceUuid must be a valid UUID');
  }
  if (!UUID_PATTERN.test(options.inboundCharacteristicUuid)) {
    throw new Error('ERR_INVALID_OPTIONS: inboundCharacteristicUuid must be a valid UUID');
  }
  if (!UUID_PATTERN.test(options.outboundCharacteristicUuid)) {
    throw new Error('ERR_INVALID_OPTIONS: outboundCharacteristicUuid must be a valid UUID');
  }

  if (options.advertiseMode && !['balanced', 'lowLatency', 'lowPower'].includes(options.advertiseMode)) {
    throw new Error('ERR_INVALID_OPTIONS: advertiseMode must be balanced | lowLatency | lowPower');
  }

  if (options.txPowerLevel && !['high', 'medium', 'low', 'ultraLow'].includes(options.txPowerLevel)) {
    throw new Error('ERR_INVALID_OPTIONS: txPowerLevel must be high | medium | low | ultraLow');
  }
}
