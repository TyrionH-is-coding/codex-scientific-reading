import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../src/core.mjs';

// Exercise the exact archive layout and BUILD-MANIFEST checks a user receives.
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'dl-release-'));
const destination = path.join(temporary, 'candidate');
async function run(script, args) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: source, shell: false, windowsHide: true, stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) throw new Error(`acceptance_command_failed: ${path.basename(script)} (${code})`);
}
await run(path.join(source, 'scripts', 'package-release.mjs'), [destination,
  path.join(source, 'inputs', 'scientific-reading.tgz')]);
const verification = await readJson(path.join(destination, 'PACKAGE-VERIFY.json'));
const release = await readJson(path.join(destination, 'RELEASE-MANIFEST.json'));
await writeJson(path.join(source, 'outputs', `platform-package-${process.platform}-${process.arch}.json`), {
  ...verification, sourceCommit: release.sourceCommit, artifacts: release.artifacts,
});
await run(path.join(verification.extractedRoot, 'scripts', 'acceptance-platform.mjs'), [
  path.join(source, 'outputs', `platform-${process.platform}-${process.arch}.json`),
]);
// Publish only the exact archive whose extracted contents passed installation.
const delivery = path.join(source, 'outputs', `platform-delivery-${process.platform}-${process.arch}`);
await fs.mkdir(delivery, { recursive: true });
for (const file of [...release.artifacts.map(item => item.file), 'RELEASE-MANIFEST.json', 'PACKAGE-VERIFY.json', 'SHA256SUMS.txt']) {
  await fs.copyFile(path.join(destination, file), path.join(delivery, file));
}
