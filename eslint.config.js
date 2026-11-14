import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'dist-drafts/',
      'dist-audit/',
      '.astro/',
      '.lighthouseci/',
      'node_modules/',
      'docs/screenshots/',
      'public/',
    ],
  },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
