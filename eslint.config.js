import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      '**/worker-configuration.d.ts',
      'apps/api/src/generated/**',
    ],
  },
  {
    rules: {
      // v9 addition not present in the original ruleset — don't let lint
      // rewrite package-manager settings
      'pnpm/yaml-enforce-settings': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'semi': ['error', 'never'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      'import/extensions': 'off',
      'unused-imports/no-unused-vars': 'off',
      'ts/no-unused-vars': 'off',
      'no-console': 'off',
      'ts/ban-ts-comment': 'off',
      'antfu/no-import-dist': 'off',
      'node/prefer-global/process': 'off',
      'antfu/no-import-node-modules-by-path': 'off',
    },
  },
)
