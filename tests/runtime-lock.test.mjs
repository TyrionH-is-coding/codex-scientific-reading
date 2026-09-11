import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('宿主依赖固定同一版本，Windows 原生进程库不重复加载', async () => {
  const manifest=JSON.parse(await fs.readFile(new URL('../runtime/package.json',import.meta.url),'utf8'));
  const lock=JSON.parse(await fs.readFile(new URL('../runtime/package-lock.json',import.meta.url),'utf8'));
  const pins=JSON.parse(await fs.readFile(new URL('../runtime/pins.json',import.meta.url),'utf8'));
  assert.deepEqual(lock.packages[''].dependencies,manifest.dependencies);
  const plugin=lock.packages['node_modules/@dsh-external/dsh-scientific-reading'];
  assert.ok(!plugin.link);
  const archive=await fs.readFile(new URL('../inputs/scientific-reading.tgz',import.meta.url));
  assert.equal(plugin.integrity,'sha512-'+createHash('sha512').update(archive).digest('base64'));
  const dsh=Object.entries(lock.packages).filter(([name])=>/node_modules\/@deepseek-ai\/dsh[^/]*$/.test(name));
  assert.ok(dsh.length>0);
  for(const [name,pkg] of dsh) assert.equal(pkg.version,pins.dsh,name);
  assert.deepEqual(dsh.filter(([name])=>name.endsWith('/dsh-win32-process')).map(([name])=>name),
    ['node_modules/@deepseek-ai/dsh-win32-process']);
});
