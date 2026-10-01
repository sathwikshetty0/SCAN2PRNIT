/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        ...require('./tsconfig.json').compilerOptions,
        jsx: 'react-jsx',
      },
    }],
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/e2e/'],
};
