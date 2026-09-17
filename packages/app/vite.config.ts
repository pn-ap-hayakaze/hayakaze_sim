import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Content Security Policy を本番ビルドの index.html にだけ注入する。
 * 開発サーバーは React Fast Refresh のプリアンブルをインラインスクリプトで入れるため、
 * 開発時に同じ CSP を掛けると動かない。本番ビルドはスクリプト・スタイルとも外部ファイルになる。
 */
function csp(): Plugin {
  return {
    name: 'hayakaze-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:">`,
      );
    },
  };
}

export default defineConfig({
  // GitHub Pages のリポジトリパス。別の場所に置くときは環境変数で上書きする
  base: process.env.HAYAKAZE_BASE ?? '/hayakaze_sim/',
  plugins: [react(), tailwindcss(), csp()],
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
