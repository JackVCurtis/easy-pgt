// Reexport the native module. On web, it will be resolved to ExpoSettingsStorageModule.web.ts
// and on native platforms to ExpoSettingsStorageModule.ts
export { default } from './ExpoSettingsStorageModule';
export { default as ExpoSettingsStorageView } from './ExpoSettingsStorageView';
export * from  './ExpoSettingsStorage.types';
