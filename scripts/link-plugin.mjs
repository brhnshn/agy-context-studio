import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const PLUGIN_NAME = 'agy-context-studio';
const RUNTIME_ITEMS = [
  'plugin.json',
  'assets',
  'sidecars',
  'hooks.json',
  'hooks',
  'mcp'
];

function resolveHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const useCopy = args.has('--copy');

  const targetPluginDir = path.join(resolveHomeDir(), '.gemini', 'config', 'plugins', PLUGIN_NAME);
  await fs.mkdir(targetPluginDir, { recursive: true });

  let linkedCount = 0;
  for (const item of RUNTIME_ITEMS) {
    const srcPath = path.join(rootDir, item);
    if (!(await exists(srcPath))) {
      console.log(`[link-plugin] skipped ${item} (not present yet)`);
      continue;
    }

    const destPath = path.join(targetPluginDir, item);
    await fs.rm(destPath, { recursive: true, force: true });

    if (useCopy) {
      await fs.cp(srcPath, destPath, { recursive: true });
      console.log(`[link-plugin] copied ${item} -> ${destPath}`);
    } else {
      const stat = await fs.stat(srcPath);
      const linkType = stat.isDirectory() ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file';
      try {
        await fs.symlink(srcPath, destPath, linkType);
        console.log(`[link-plugin] linked ${item} -> ${destPath}`);
      } catch {
        await fs.cp(srcPath, destPath, { recursive: true });
        console.log(`[link-plugin] symlink fallback copied ${item} -> ${destPath}`);
      }
    }
    linkedCount += 1;
  }

  console.log(`[link-plugin] ready at ${targetPluginDir} (${linkedCount} items)`);
}

main().catch((error) => {
  console.error('[link-plugin] failed:', error);
  process.exitCode = 1;
});
