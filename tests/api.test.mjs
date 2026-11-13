import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('local API validates briefs, persists preview output, and protects its boundary',async(t)=>{
  const reserve=createServer(); reserve.listen(0,'127.0.0.1'); await once(reserve,'listening');
  const port=reserve.address().port; await new Promise(r=>reserve.close(r));
  const dir=await mkdtemp(join(tmpdir(),'amo-studio-api-'));
  const child=spawn(process.execPath,[fileURLToPath(new URL('../studio-server.mjs',import.meta.url))],{cwd:dir,env:{...process.env,PORT:String(port),STUDIO_PROVIDER:'gateway',AI_GATEWAY_API_KEY:''},stdio:['ignore','pipe','pipe']});
  try {
    await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Startup timed out')),5000).unref())]);
    const base=`http://127.0.0.1:${port}`;
    const post=data=>fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    await t.test('browser entry and config are available without credentials',async()=>{
      assert.equal((await fetch(base)).status,200);
      const config=await (await fetch(base+'/api/config')).json(); assert.equal(config.liveConfigured,false);
      assert.equal(config.specialists.length,7);
      assert.ok(config.platformRegistry.instagram.surfaces.reel);
    });
    await t.test('missing required details are rejected',async()=>{
      assert.equal((await post({brief:{business:'Incomplete'}})).status,400);
    });
    const brief={business:'Fictional test',audience:'Neighbors',objective:'Visits',platforms:'Instagram'};
    await t.test('live calls are refused when model connection is absent',async()=>{
      assert.equal((await post({brief,mode:'live'})).status,409);
    });
    await t.test('cross-origin writes are rejected',async()=>{
      assert.equal((await fetch(base+'/api/runs',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'})).status,403);
    });
    await t.test('preview returns saved artifacts and exact event sequence',async()=>{
      const response=await post({brief,mode:'preview'});assert.equal(response.status,202);
      const {id}=await response.json();let run;
      for(let i=0;i<30;i++) {run=await (await fetch(base+'/api/runs/'+id)).json();if(!['queued','running'].includes(run.status))break;await new Promise(r=>setTimeout(r,20));}
      assert.equal(run.status,'example_only');assert.equal(Object.keys(run.outputs).length,6);
      assert.equal(run.compound.targets.length,1); assert.equal(run.compound.publication.status,'disabled');
      assert.equal(run.platformEvaluations.length,3); assert.ok(run.platformEvaluations.every(item=>item.passed));
      const markdown=await fetch(base+'/api/runs/'+id+'/compound.md'); assert.equal(markdown.status,200); assert.match(await markdown.text(),/# Prompt Studio compound package/);
      assert.equal(run.events.length,13);
      const history=await (await fetch(base+'/api/runs')).json();assert.equal(history[0].id,id);
    });
    await t.test('optional research preview records a plan without contacting the web',async()=>{
      const response=await post({brief,mode:'preview',webResearch:true}); assert.equal(response.status,202);
      const {id}=await response.json(); let run;
      for(let i=0;i<30;i++){run=await (await fetch(base+'/api/runs/'+id)).json();if(!['queued','running'].includes(run.status))break;await new Promise(r=>setTimeout(r,20));}
      assert.equal(run.status,'example_only'); assert.equal(run.webResearch.status,'example_only');
      assert.ok(run.outputs.research); assert.equal(run.webResearch.sources.length,0); assert.equal(run.events.length,15);
    });
  } finally { child.kill('SIGTERM'); await once(child,'exit'); await rm(dir,{recursive:true,force:true}); }
});
