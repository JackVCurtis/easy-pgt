// Reexport the native module. On web, it will be resolved to ExpoBlePeripheralModule.web.ts
// and on native platforms to ExpoBlePeripheralModule.ts
export { default } from './ExpoBlePeripheralModule';
export { default as ExpoBlePeripheralView } from './ExpoBlePeripheralView';
export * from  './ExpoBlePeripheral.types';
