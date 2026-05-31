import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  tseslint.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    rules: {
      'no-console': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    ignores: ['**/fixtures', 'dist/**'],
  },
);
