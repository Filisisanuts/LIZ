import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 旧系统脚本仍通过普通 script 标签按顺序运行，Vite 不会自动打包它们。
 * 在生成 dist 时将这些运行时文件原样写入对应路径，保证 dist 可独立部署。
 */
const legacyRuntimeAssets = {
  name: 'copy-legacy-runtime-assets',
  generateBundle() {
    const legacyJsDir = resolve(__dirname, 'src/js');
    for (const fileName of readdirSync(legacyJsDir)) {
      if (!fileName.endsWith('.js')) continue;
      this.emitFile({
        type: 'asset',
        fileName: `src/js/${fileName}`,
        source: readFileSync(resolve(legacyJsDir, fileName)),
      });
    }
    this.emitFile({
      type: 'asset',
      fileName: 'src/css/style.css',
      source: readFileSync(resolve(__dirname, 'src/css/style.css')),
    });
  },
  transformIndexHtml(html: string) {
    return html.replace(
      /\b(src|href)=("|')(\/?)(src\/(?:js\/[^"']+\.js|css\/style\.css))(?:\?[^"']*)?\2/g,
      (_match, attribute: string, quote: string, leadingSlash: string, assetPath: string) => {
        const version = createHash('sha256')
          .update(readFileSync(resolve(__dirname, assetPath)))
          .digest('hex')
          .slice(0, 12);
        return attribute + '=' + quote + leadingSlash + assetPath + '?v=' + version + quote;
      },
    );
  },
};

export default defineConfig({
  plugins: [legacyRuntimeAssets],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
      },
    },
  },
});
