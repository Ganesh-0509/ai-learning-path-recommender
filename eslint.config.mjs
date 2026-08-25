import {defineConfig, globalIgnores} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import gtsConfig from 'gts/build/eslint.config.js';

const projectRoot = import.meta.dirname;

// react-hooks rules come from eslint-config-next (nextVitals below), which already
// depends on eslint-plugin-react-hooks — no need to wire it in separately.
const eslintConfig = defineConfig([
  ...gtsConfig,
  ...nextVitals,
  ...nextTs,
  {
    // gts's own config resolves `project: './tsconfig.json'` relative to gts's
    // installed package directory, not this repo — repoint it at ours.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: projectRoot,
      },
    },
  },
  {
    rules: {
      // Project-specific tightening on top of gts + Next defaults — see
      // docs/CODING_STANDARDS.md for the reasoning.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', {allow: ['warn', 'error']}],
    },
  },
  {
    // node:test's `test()` returns a Promise by design (its own concurrency
    // model), intentionally unawaited at the top level of a test file.
    files: ['tests/unit/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    // scripts/ are dev-time CLI tools — console output IS their interface.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'archive_2026-08-25/**',
    'test-results/**',
    'playwright-report/**',
    'app/generated/**', // Prisma-generated client — not hand-edited, not our style to enforce.
  ]),
]);

export default eslintConfig;
