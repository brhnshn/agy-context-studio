import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function classicSidecarHtmlPlugin(): Plugin {
  return {
    name: 'classic-sidecar-html',
    enforce: 'post',
    transformIndexHtml(html) {
      let transformed = html.replace(/\s+crossorigin(?:="[^"]*")?/gi, '');
      const moduleScriptRe = /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]*\/assets\/app\.js)"[^>]*>\s*<\/script>\s*/i;
      const match = moduleScriptRe.exec(transformed);
      if (match) {
        const scriptSrc = match[1];
        transformed = transformed.replace(match[0], '');
        transformed = transformed.replace(
          '</body>',
          `    <script src="${scriptSrc}"></script>\n  </body>`
        );
      }
      return transformed;
    }
  };
}

export default defineConfig({
  plugins: [react(), classicSidecarHtmlPlugin()],
  root: path.resolve(__dirname, 'src/ui'),
  base: '/',
  build: {
    outDir: path.resolve(__dirname, 'sidecars/agy-context-studio/public'),
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'ContextStudioApp',
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/app.[ext]',
        inlineDynamicImports: true
      }
    }
  }
});
