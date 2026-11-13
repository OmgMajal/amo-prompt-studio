import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('saved runs use snapshots and interrupted runs never silently resume',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'amo-studio-store-'));
  try {
    const url = new URL('../studio/store.mjs',import.meta.url).href;
    const script = `import assert from 'node:assert/strict';
      import {saveRun,loadRuns} from ${JSON.stringify(url)};
      const run={id:'11111111-1111-1111-1111-111111111111',status:'running',events:[],outputs:{brief:{summary:'Retained evidence'}}};
      const save=saveRun(run); run.outputs.brief.summary='Later mutation'; await save;
      const loaded=await loadRuns();
      assert.equal(loaded[0].outputs.brief.summary,'Retained evidence');
      assert.equal(loaded[0].status,'interrupted');
      assert.equal(loaded[0].events.at(-1).status,'interrupted');
      console.log('snapshot and restart checks passed');`;
    assert.match(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:dir,encoding:'utf8'}),/checks passed/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
