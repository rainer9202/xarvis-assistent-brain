// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // supertest's Response#body is untyped (any) by design — asserting on
    // res.body.data.* in e2e specs is inherently "unsafe" from eslint's
    // point of view with no practical fix short of a hand-typed response
    // wrapper. Relaxed the same way no-unsafe-argument already is project-wide.
    files: ['test/**/*.e2e-spec.ts', 'test/utils/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    // jest.Mocked<T> + `expect(repository.method).toHaveBeenCalledWith(...)`
    // is the standard jest mocking pattern and never actually detaches
    // `this` — unbound-method's false positive on it is a well-known
    // typescript-eslint/jest friction point (usually solved by
    // eslint-plugin-jest, which this project doesn't otherwise need).
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
