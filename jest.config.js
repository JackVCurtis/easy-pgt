module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-settings-storage$': '<rootDir>/tests/mocks/expo-settings-storage.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
