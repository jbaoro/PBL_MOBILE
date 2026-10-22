import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = mkdtempSync(join(root, '.meetpoint-tests-'));
try {
  const compiled = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.test.json', '--outDir', output], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (compiled.error) throw compiled.error;
  if (compiled.status !== 0) process.exitCode = compiled.status ?? 1;
  else {
    const testDirectory = join(output, 'tests/meetpoint');
    const files = readdirSync(testDirectory).filter((name) => name.endsWith('.test.js')).map((name) => join(testDirectory, name));
    const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} finally {
  // Only remove the unique compilation directory created by this invocation.
  if (dirname(output) !== root || !basename(output).startsWith('.meetpoint-tests-')) throw new Error('Unexpected test output directory');
  rmSync(output, { recursive: true, force: true });
}
