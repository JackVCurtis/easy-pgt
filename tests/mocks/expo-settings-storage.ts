const SettingsStorage = {
  getItem: jest.fn(async (_key: string) => null as string | null),
  setItem: jest.fn(async (_key: string, _value: string) => undefined),
  deleteItem: jest.fn(async (_key: string) => undefined),
};

export default SettingsStorage;
