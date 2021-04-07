module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testURL: 'http://localhost/',
  setupFiles: ['./tests/setup.js'],
  moduleFileExtensions: ['js', 'ts', "json"],
  modulePathIgnorePatterns: [],
  testPathIgnorePatterns: ['/node_modules/', 'node'],
  testMatch: [
    "**/__tests__/*.test.ts",
    "**/__tests__/*.sepc.ts",
  ],
  transform: {
    '^.+\\.(js)$': '<rootDir>/node_modules/babel-jest',
    '^.+\\.(ts)$': '<rootDir>/node_modules/ts-jest'
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  collectCoverage: process.env.COVERAGE === 'true',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!**/node_modules/**',
  ],
  testEnvironment: 'node',
  transformIgnorePatterns: [],
  globals: {
    'ts-jest': {
      babelConfig: true,
      tsconfig: './tsconfig.test.json'
    },
  }
}
