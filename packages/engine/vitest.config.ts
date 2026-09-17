import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // 較正テストは6シーズンを回すので既定の5秒では足りないことがある
    testTimeout: 60_000,
  },
});
