import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = await fs.realpath(path.dirname(fileURLToPath(import.meta.url)));
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const marker = await read('.workbench.json');
if (marker.product !== 'codex-scientific-reading' || marker.root !== root) throw new Error('invalid_instance');
const installed = await read('installation.json');
const app = await fs.realpath(installed.app);
if (!app.startsWith(path.join(root, 'releases') + path.sep)) throw new Error('invalid_release_path');
const [action = 'status', ...args] = process.argv.slice(2);
if (action === 'uninstall') {
  const { retireInstallation } = await import(pathToFileURL(path.join(app, 'src', 'releases.mjs')));
  const retired = await retireInstallation(root);
  if (retired.status !== 'uninstalled' || retired.root !== root) throw new Error('uninstall_not_retired');
  for (const name of ['releases', 'runtime']) {
    const target = path.join(root, name);
    if (!retired.removePaths.includes(target) || (await fs.lstat(target)).isSymbolicLink()) throw new Error('invalid_uninstall_target');
    await fs.rm(target, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ ok: true, ...retired }));
} else {
  process.argv = [process.execPath, path.join(app, 'src', 'cli.mjs'), action, root, ...args];
  await import(pathToFileURL(process.argv[1]));
}
