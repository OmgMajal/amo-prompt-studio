import { mkdir, writeFile, rename, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const root = join(process.cwd(), '.studio', 'runs');
let queue = Promise.resolve();
export function saveRun(run) {
  const snapshot = JSON.stringify(run, null, 2);
  const task = queue.then(async () => {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const target = join(root, `${run.id}.json`);
    await writeFile(`${target}.tmp`, snapshot, { mode: 0o600 });
    await rename(`${target}.tmp`, target);
  });
  queue = task.catch(() => {}); return task;
}
export async function loadRuns() {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const runs = [];
  for (const name of await readdir(root)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
    try {
      const run = JSON.parse(await readFile(join(root, name), 'utf8'));
      if (['queued','running'].includes(run.status)) {
        run.status = 'interrupted'; run.finishedAt = new Date().toISOString();
        run.events.push({ sequence: run.events.length + 1, at: run.finishedAt, role: 'studio', status: 'interrupted', detail: 'Server restarted. Partial work retained; run was not resumed or approved.' });
        await saveRun(run);
      }
      runs.push(run);
    } catch { console.warn('A saved run could not be read; original file retained.'); }
  }
  return runs;
}
