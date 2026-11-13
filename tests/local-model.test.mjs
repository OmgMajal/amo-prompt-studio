import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelSettings, connectionStatus, generateSpecialist } from '../studio/model.mjs';

test('local inference is the default even when a paid key exists',async()=>{
  const before={...process.env};
  try {
    delete process.env.STUDIO_PROVIDER;
    process.env.AI_GATEWAY_API_KEY='TEST_NOT_A_REAL_KEY';
    assert.equal(modelSettings().provider,'ollama');
    assert.equal(modelSettings().model,'qwen3:4b');
  } finally { process.env=before; }
});
test('cloud aliases and remote model records cannot enable free local mode',async()=>{
  const original=globalThis.fetch; const before={...process.env};
  process.env.STUDIO_PROVIDER='ollama';
  try {
    for (const record of [{name:'qwen3:4b',remote_host:'https://ollama.com'},{name:'qwen3:4b',remote_model:'remote'}]) {
      globalThis.fetch=async()=>({ok:true,json:async()=>({models:[record]})});
      assert.equal((await connectionStatus()).ready,false);
    }
  } finally {globalThis.fetch=original;process.env=before;}
});
test('local generation sends schema and brief only to loopback and reports zero API cost',async()=>{
  const original=globalThis.fetch; const before={...process.env};
  process.env.STUDIO_PROVIDER='ollama'; process.env.STUDIO_LOCAL_MODEL='qwen3:4b';
  const out={roleId:'brief',summary:'A test handoff',factsUsed:[],assumptions:[],uncertainties:[],disagreements:[],deliverables:[],review:{verdict:'not_applicable',findings:[]}};
  const calls=[];
  try {
    globalThis.fetch=async(url,options)=>{
      calls.push(url); assert.ok(url.startsWith('http://127.0.0.1:11434/'));
      if(url.endsWith('/api/tags')) return {ok:true,json:async()=>({models:[{name:'qwen3:4b'}]})};
      const body=JSON.parse(options.body); assert.equal(body.think,false);assert.equal(body.format.type,'object'); assert.equal(options.headers.Authorization,undefined);
      return {ok:true,json:async()=>({done:true,done_reason:'stop',model:'qwen3:4b',message:{content:JSON.stringify(out)},prompt_eval_count:100,eval_count:40})};
    };
    const result=await generateSpecialist({role:{id:'brief',name:'Analyst',task:'Analyze'},system:'Rules',brief:{business:'Fictional'},facts:[],prior:{},signal:new AbortController().signal});
    assert.equal(calls.length,2);assert.equal(result.execution.apiCostUsd,0);assert.equal(result.execution.provider,'ollama');
  } finally {globalThis.fetch=original;process.env=before;}
});
test('unavailable local inference never falls back to paid calls',async()=>{
  const original=globalThis.fetch;const before={...process.env};process.env.STUDIO_PROVIDER='ollama';let calls=0;
  try {
    globalThis.fetch=async(url)=>{calls++;assert.ok(url.startsWith('http://127.0.0.1:11434/'));throw Error('Offline');};
    await assert.rejects(()=>generateSpecialist({role:{name:'Analyst',task:'Analyze'}}));
    assert.equal(calls,1);
  } finally {globalThis.fetch=original;process.env=before;}
});
