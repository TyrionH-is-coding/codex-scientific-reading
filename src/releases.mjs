import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { initializeRoot, readJson, writeJson, removeManagedSkill } from './core.mjs';
import * as control from './control.mjs';
import { snapshotLibrary } from './library-transfer.mjs';

const transitionFile = root => path.join(root, 'state', 'release-transition.json');
export const maintenancePipe = root => `${control.pipeName(root)}-maintenance`;

async function optionalJson(file) {
  try { return await readJson(file); } catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
}

async function exclusive(root, action) {
  const server = net.createServer(socket => { socket.on('error', () => {}); socket.end('maintenance'); });
  await new Promise((resolve, reject) => {
    server.once('error', error => reject(new Error(error.code === 'EADDRINUSE' ? 'maintenance_in_progress' : error.message)));
    server.listen(maintenancePipe(root), resolve);
  });
  try { return await action(); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function validateRelease(root, release) {
  if (release?.product !== 'codex-scientific-reading' || !/^[a-f0-9]{64}$/.test(release.appSha256 ?? '')) throw new Error('invalid_release');
  const slot = path.join(root, 'releases', release.appSha256.slice(0, 16));
  if (release.slot !== slot || release.app !== path.join(slot, 'app') ||
      release.profileModules !== path.join(slot, 'profile-modules') || await fs.realpath(slot) !== slot) throw new Error('invalid_release_path');
  if (release.profilePackage && release.profilePackage !== path.join(slot, 'profile-package.json')) throw new Error('invalid_profile_package');
  const expected = await readJson(path.join(slot, 'release.json'));
  if (JSON.stringify(expected) !== JSON.stringify(release)) throw new Error('release_descriptor_mismatch');
}

async function select(root, release) {
  const profile = path.join(root, 'state', 'dsh-home', 'profiles', 'workbench');
  await fs.mkdir(profile, { recursive: true });
  const link = path.join(profile, 'node_modules');
  try {
    if (!(await fs.lstat(link)).isSymbolicLink()) throw new Error('profile_modules_not_managed');
    const target = await fs.realpath(link);
    const relative = path.relative(path.join(root, 'releases'), target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('external_profile_modules');
    await fs.unlink(link);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (release) {
    if (release.profilePackage) await fs.copyFile(release.profilePackage, path.join(profile, 'package.json'));
    await fs.symlink(release.profileModules, link, 'junction');
    await writeJson(path.join(root, 'installation.json'), release);
  } else await fs.rm(path.join(root, 'installation.json'), { force: true });
}

// Slots contain code only. A's SQLite, papers, sessions and credentials remain in
// their stable directories; selecting an old executable must never restore old data.
export async function activateRelease(requestedRoot, candidate, { lifecycle = control, snapshot = snapshotLibrary } = {}) {
  const { root } = await initializeRoot(requestedRoot);
  return exclusive(root, async () => {
    if (await optionalJson(transitionFile(root))) throw new Error('release_recovery_required');
    const previous = await optionalJson(path.join(root, 'installation.json'));
    if (previous && previous.dataFormat !== candidate.dataFormat) throw new Error('incompatible_data_format: migration is required');
    await validateRelease(root, candidate);
    if (previous?.appSha256 === candidate.appSha256) return { status: 'unchanged', release: previous };
    const wasRunning = (await lifecycle.status(root)).status === 'running';
    const transition = { previous, candidate, wasRunning, startedAt: new Date().toISOString() };
    await writeJson(transitionFile(root), transition);
    try {
      await lifecycle.stop(root);
      if (previous) transition.backup = await snapshot(root, previous);
      await writeJson(transitionFile(root), transition);
      await select(root, candidate);
      await lifecycle.start(root, { maintenance: true });
      if (!wasRunning) await lifecycle.stop(root);
      const historyFile = path.join(root, 'state', 'release-history.json');
      const history = await optionalJson(historyFile) ?? [];
      await writeJson(historyFile, [...history, { previous, current: candidate, at: new Date().toISOString() }]);
      await fs.rm(transitionFile(root));
      return { status: previous ? 'upgraded' : 'installed', release: candidate };
    } catch (error) {
      await lifecycle.stop(root);
      await select(root, previous);
      if (previous && wasRunning) await lifecycle.start(root, { maintenance: true });
      await writeJson(path.join(root, 'state', 'last-release-failure.json'), { ...transition, error: error.message });
      await fs.rm(transitionFile(root));
      throw error;
    }
  });
}

export async function rollbackRelease(root, options = {}) {
  const current = await readJson(path.join(root, 'installation.json'));
  const history = await optionalJson(path.join(root, 'state', 'release-history.json')) ?? [];
  const previous = [...history].reverse().find(entry => entry.current.appSha256 === current.appSha256 && entry.previous)?.previous;
  if (!previous) throw new Error('no_previous_release');
  return activateRelease(root, previous, options);
}

export async function recoverRelease(requestedRoot, { lifecycle = control } = {}) {
  const { root } = await initializeRoot(requestedRoot);
  return exclusive(root, async () => {
    const transition = await optionalJson(transitionFile(root));
    if (!transition) return { status: 'no_recovery_needed' };
    if (transition.previous) await validateRelease(root, transition.previous);
    await lifecycle.stop(root);
    await select(root, transition.previous);
    if (transition.previous && transition.wasRunning) await lifecycle.start(root, { maintenance: true });
    await writeJson(path.join(root, 'state', 'last-release-recovery.json'), transition);
    await fs.rm(transitionFile(root));
    return { status: 'recovered', release: transition.previous };
  });
}

export async function retireInstallation(requestedRoot, { lifecycle = control, snapshot = snapshotLibrary } = {}) {
  const { root } = await initializeRoot(requestedRoot);
  return exclusive(root, async () => {
    if (await optionalJson(transitionFile(root))) throw new Error('release_recovery_required');
    const release = await readJson(path.join(root, 'installation.json'));
    await validateRelease(root, release);
    await lifecycle.stop(root);
    const backup = await snapshot(root, release);
    const skill = await removeManagedSkill(root);
    const result = { status: 'uninstalled', root, release, backup, skill, retiredAt: new Date().toISOString(),
      preserved: ['library', 'workspace', 'state', '.workbench.json'], removePaths: ['releases', 'runtime'].map(name => path.join(root, name)) };
    await writeJson(path.join(root, 'state', 'uninstalled.json'), result);
    await select(root, null);
    return result;
  });
}
