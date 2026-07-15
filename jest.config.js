module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
  },
  transform: {
    // Babel presets are passed inline (rather than via a repo-level .babelrc) so
    // that Next.js keeps using SWC for builds — a checked-in .babelrc would disable
    // SWC and break next/font. These presets apply to Jest only.
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      {
        presets: [
          '@babel/preset-env',
          ['@babel/preset-react', { runtime: 'automatic' }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!@auth/prisma-adapter).+\\.js$'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/', '/.worktrees/'],
};
