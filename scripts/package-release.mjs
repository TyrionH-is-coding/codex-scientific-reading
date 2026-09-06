import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readJson, writeJson, verifyFile, VERSION } from '../src/core.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(process.argv[2]);
const archive = path.resolve(process.argv[3] || path.join(source, 'inputs', 'scientific-reading.tgz'));
const pins = await readJson(path.join(source, 'runtime', 'pins.json'));
await verifyFile(archive, pins.plugin.sha256);
// Never replace an existing reviewed candidate.
await fs.mkdir(destination);
const payload = path.join(destination, 'payload');
const packageName = `codex-scientific-reading-${VERSION}-win-x64`;
const packageRoot = path.join(payload, packageName);
await fs.mkdir(packageRoot, { recursive: true });
async function copy(relative, from = path.join(source, relative)) {
  const to = path.join(packageRoot, relative);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
}
for (const file of ['README.md', 'START_HERE.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'package.json', 'install.ps1', 'workbench.ps1', 'uninstall.ps1']) await copy(file);
for (const folder of ['src', 'skills', 'scripts', 'tests']) {
  await fs.cp(path.join(source, folder), path.join(packageRoot, folder), { recursive: true,
    filter: file => !file.split(path.sep).some(part => ['node_modules', '.work', '.git', 'outputs', 'test-results'].includes(part)) });
}
for (const file of ['package.json', 'package-lock.json', 'pins.json', 'requirements.in', 'requirements.lock']) await copy('runtime/' + file);
for (const file of ['index.mjs', 'adapter.mjs', 'app-server.mjs', 'control.mjs', 'http.mjs', 'ui.mjs', 'cordis.patch.yml', 'LICENSE', 'README.md', 'package.json', 'package-lock.json', 'provenance.json']) await copy('oauth/' + file);
for (const file of ['adapter.js', 'LICENSE']) await copy('oauth/vendor/dsh-openai-oauth/' + file);
for (const file of ['lifecycle.md', 'oauth.md', 'handoff-contract.md', 'release-notes.md', 'acceptance.md']) await copy('docs/' + file);
await copy('inputs/scientific-reading.tgz', archive);
const files = {};
async function inventory(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inventory(file);
    else if (entry.isFile()) files[path.relative(packageRoot, file).replaceAll('\\', '/')] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
    else throw new Error('release_link_not_allowed');
  }
}
await inventory(packageRoot);
await writeJson(path.join(packageRoot, 'BUILD-MANIFEST.json'), { schema: 1, product: 'codex-scientific-reading', version: VERSION,
  channel: pins.channel, source: 'reviewable working-tree snapshot; no source commit claimed', pins, files });
const zip = path.join(destination, packageName + '.zip');
await new Promise((resolve, reject) => {
  const child = spawn(path.join(process.env.SYSTEMROOT, 'System32', 'tar.exe'), ['-a', '-cf', zip, packageName],
    { cwd: payload, windowsHide: true, shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', data => process.stderr.write(data)); child.on('error', reject);
  child.on('close', code => code === 0 ? resolve() : reject(new Error('zip_failed')));
});
const aName = `dsh-external-dsh-scientific-reading-${pins.plugin.version}.tgz`;
await fs.copyFile(archive, path.join(destination, aName));
const zipSha = createHash('sha256').update(await fs.readFile(zip)).digest('hex');
const extracted = path.join(destination, 'verified-extraction');
await fs.mkdir(extracted);
await new Promise((resolve, reject) => {
  const child = spawn(path.join(process.env.SYSTEMROOT, 'System32', 'tar.exe'), ['-xf', zip, '-C', extracted],
    { windowsHide: true, shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', data => process.stderr.write(data)); child.on('error', reject);
  child.on('close', code => code === 0 ? resolve() : reject(new Error('zip_readback_failed')));
});
const extractedRoot = path.join(extracted, packageName);
const expected = { ...files, 'BUILD-MANIFEST.json': createHash('sha256')
  .update(await fs.readFile(path.join(packageRoot, 'BUILD-MANIFEST.json'))).digest('hex') };
let verifiedFiles = 0;
async function verifyExtracted(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await verifyExtracted(file);
    else {
      const relative = path.relative(extractedRoot, file).replaceAll('\\', '/');
      if (!entry.isFile() || !expected[relative]) throw new Error('unexpected_packaged_file');
      await verifyFile(file, expected[relative]); verifiedFiles++;
    }
  }
}
await verifyExtracted(extractedRoot);
if (verifiedFiles !== Object.keys(expected).length) throw new Error('packaged_file_missing');
await writeJson(path.join(destination, 'PACKAGE-VERIFY.json'), { zipSha256: zipSha, verifiedFiles,
  extractedRoot, verification: 'Every extracted file SHA matches the source inventory; no extra files.', passed: true });
const manifest = { schema: 1, channel: pins.channel, version: VERSION, createdAt: new Date().toISOString(),
  artifacts: [{ file: path.basename(zip), sha256: zipSha }, { file: aName, sha256: pins.plugin.sha256 }],
  sourceCommit: null, sourceSnapshot: 'BUILD-MANIFEST.json inside the B archive',
  compatibility: { windows: 'x64, PowerShell 5.1+', node: pins.node.version, python: pins.python.version, dsh: pins.dsh, a: pins.plugin.version, codexCli: '0.146.0' },
  validation: 'See the accompanying acceptance record. Real account authorization and scientific content acceptance must be stated separately.' };
await writeJson(path.join(destination, 'RELEASE-MANIFEST.json'), manifest);
const manifestSha = createHash('sha256').update(await fs.readFile(path.join(destination, 'RELEASE-MANIFEST.json'))).digest('hex');
const verifySha = createHash('sha256').update(await fs.readFile(path.join(destination, 'PACKAGE-VERIFY.json'))).digest('hex');
await fs.writeFile(path.join(destination, 'SHA256SUMS.txt'), [...manifest.artifacts.map(item => `${item.sha256}  ${item.file}`),
  `${manifestSha}  RELEASE-MANIFEST.json`, `${verifySha}  PACKAGE-VERIFY.json`].join('\n') + '\n');
console.log(JSON.stringify({ destination, zip, zipSha, aName, aSha256: pins.plugin.sha256, sourceFiles: Object.keys(files).length, verifiedFiles, extractedRoot }, null, 2));
