import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const temporary = await mkdtemp(fileURLToPath(new URL('.test-sensitivity-', root)));
const source = await readFile(new URL('skip-twitch-muted-segments.src.ts', root), 'utf8');
const selected = 'skips native translucent muted segments|waits for playback after a paused manual seek';

async function run(name: string, input: string, expectedFailure?: string): Promise<void> {
  await writeFile(`${temporary}/skip-twitch-muted-segments.src.ts`, input);
  const build = spawnSync(process.execPath, [`${temporary}/tools/build.ts`], { cwd: fileURLToPath(root), encoding: 'utf8', timeout: 60000 });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const tests = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=${selected}`, `${temporary}/tests/behavior.test.ts`], {
    cwd: fileURLToPath(root), encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024
  });
  const output = tests.stdout + tests.stderr;
  if (!expectedFailure) {
    assert.equal(tests.status, 0, output);
  } else {
    assert.equal(tests.status, 1, output);
    const failed = [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]);
    for (const artifact of ['src', 'user']) assert.ok(failed.includes(`${artifact}: ${expectedFailure}`), output);
  }
  process.stdout.write(`${name}: ${expectedFailure ? 'rejected by both artifacts' : 'passed'}\n`);
}

try {
  await cp(new URL('tests/', root), `${temporary}/tests`, { recursive: true });
  await mkdir(`${temporary}/tools`);
  await cp(new URL('tools/build.ts', root), `${temporary}/tools/build.ts`);
  await run('Observed-scenario baseline', source);
  const mutations = [
    ['Ignored channel recording URLs', String.raw`|[^/]+\/video\/`, 'skips native translucent muted segments on channel recording URLs'],
    ['Disabled paused-playback protection', 'video.paused || ', 'waits for playback after a paused manual seek into a muted range']
  ] satisfies readonly [string, string, string][];
  for (const [name, predicate, expectedFailure] of mutations) {
    assert.equal(source.split(predicate).length, 2);
    await run(name, source.replace(predicate, ''), expectedFailure);
  }
} finally { await rm(temporary, { recursive: true, force: true }); }
