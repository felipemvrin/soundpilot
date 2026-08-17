import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularParser from '@angular-eslint/template-parser';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'storybook-static/**',
      '.angular/**',
      '.npm-cache/**',
      '.home/**',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@angular-eslint': angular, '@typescript-eslint': tseslint.plugin },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@angular-eslint/component-class-suffix': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: { parser: angularParser },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: { '@angular-eslint/template/eqeqeq': 'error' },
  },
];
