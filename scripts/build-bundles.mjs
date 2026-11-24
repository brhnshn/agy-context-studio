import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const ENTRYPOINTS = [
  {
    name: 'sidecar-server',
    entry: path.join(rootDir, 'src/sidecar/server.ts'),
    outfile: path.join(rootDir, 'sidecars/agy-context-studio/server.mjs')
  },
  {
    name: 'post-invocation-hook',
    entry: path.join(rootDir, 'src/hooks/post-invocation.ts'),
    outfile: path.join(rootDir, 'hooks/post-invocation.mjs')
  },
  {
    name: 'optin-mcp-server',
    entry: path.join(rootDir, 'src/mcp/server.ts'),
    outfile: path.join(rootDir, 'mcp/server.mjs')
  }
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let builtCount = 0;

  for (const target of ENTRYPOINTS) {
    if (!(await exists(target.entry))) {
      console.log(`[build-bundles] skipped ${target.name} (${path.relative(rootDir, target.entry)} not yet created)`);
      continue;
    }

    await fs.mkdir(path.dirname(target.outfile), { recursive: true });
    await esbuild.build({
      entryPoints: [target.entry],
      outfile: target.outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      sourcemap: false,
      minify: false,
      legalComments: 'none'
    });
    builtCount += 1;
    console.log(`[build-bundles] built ${path.relative(rootDir, target.outfile)}`);
  }

  console.log(`[build-bundles] done (${builtCount}/${ENTRYPOINTS.length} bundles built)`);
}

main().catch((error) => {
  console.error('[build-bundles] failed:', error);
  process.exitCode = 1;
});
