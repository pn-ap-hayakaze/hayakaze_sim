// ESLint flat config（全パッケージ共通）。
// engine の src/ にはブラウザ・Node・乱数・壁時計への依存を禁止する上書きを掛ける（docs/architecture.md 4.1）。
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      // 凍結した参照実装。lint 対象にしない
      'prototype/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 意図的に使わない引数・変数は _ 始まりで示す
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // エンジンの実行時コード。DOM・Node・Math.random・Date.now を禁止する
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'エンジン内では Math.random() を使わず、引数で受け取った Rng を使う',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'エンジン内で壁時計を読まない。暦はゲームデータ',
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'fetch',
        'navigator',
        'setTimeout',
        'setInterval',
        'requestAnimationFrame',
      ],
    },
  },
  {
    // UI 層はエンジンの公開面（@hayakaze/engine）だけを使う。深い import を禁止
    files: ['packages/app/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@hayakaze/engine/*'],
              message: 'エンジンは @hayakaze/engine の公開面からだけ import する',
            },
          ],
        },
      ],
    },
  },
);
