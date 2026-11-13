import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { newRun, executeRun } from './studio/engine.mjs';
import { generateSpecialist, connectionStatus } from './studio/model.mjs';
import { SPECIALISTS, RULES } from './studio/rules.mjs';
import { PLATFORM_REGISTRY, PLATFORM_REGISTRY_VERSION } from './studio/platforms.mjs';
import { saveRun, loadRuns } from './studio/store.mjs';
import { renderCompoundMarkdown } from './studio/compound.mjs';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const port = Number(process.env.PORT || 4310);
const runs = new Map((await loadRuns()).map(r => [r.id, r]));
let active;
const files = { '/': ['public/index.html','text/html'], '/app.js': ['public/app.js','text/javascript'], '/style.css': ['public/style.css','text/css'] };
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) return send(res,403,{error:'Local access only.'});
    if (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return send(res,403,{error:'Origin rejected.'});
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === 'GET' && files[url.pathname]) {
      const [path, type] = files[url.pathname]; res.writeHead(200,{'Content-Type':type}); return res.end(await readFile(fileURLToPath(new URL(path, import.meta.url))));
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      const connection = await connectionStatus();
      return send(res,200,{ liveConfigured: connection.ready, model: connection.model, provider: connection.provider, connectionMessage: connection.message, specialists: SPECIALISTS, rules: RULES, platformRegistryVersion: PLATFORM_REGISTRY_VERSION, platformRegistry: PLATFORM_REGISTRY });
    }
    if (req.method === 'GET' && url.pathname === '/api/runs') return send(res,200,[...runs.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(({id,createdAt,status,mode,brief}) => ({id,createdAt,status,mode,business:brief.business})));
    const match = url.pathname.match(/^\/api\/runs\/([a-f0-9-]{36})(\/cancel|\/compound\.md)?$/);
    if (match) {
      const run = runs.get(match[1]); if (!run) return send(res,404,{error:'Run not found.'});
      if (req.method === 'GET' && !match[2]) return send(res,200,run);
      if (req.method === 'GET' && url.pathname.endsWith('/compound.md')) {
        if (!run.compound) return send(res,409,{error:'Compound package is not available for this run.'});
        res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="prompt-studio-${run.id}.md"`, 'Cache-Control': 'no-store' });
        return res.end(renderCompoundMarkdown(run.compound));
      }
      if (req.method === 'POST' && match[2] === '/cancel') {
        if (active?.id !== run.id) return send(res,409,{error:'This run is no longer running.'});
        active.controller.abort(); return send(res,202,{status:'stopping'});
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/runs') {
      if (active) return send(res,409,{error:'A run is already working. Wait or stop it first.'});
      if (!req.headers['content-type']?.startsWith('application/json')) return send(res,415,{error:'Send a JSON brief.'});
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 40000) return send(res,413,{error:'Brief is too large.'}); }
      let run; try { const data = JSON.parse(body); run = newRun(data.brief, data.mode, { webResearch: data.webResearch === true }); } catch (error) { return send(res,400,{error:error.message}); }
      if (active) return send(res,409,{error:'A run is already working. Wait or stop it first.'});
      if (run.mode === 'live') {
        const connection = await connectionStatus();
        if (!connection.ready) return send(res,409,{error:connection.message});
        run.connection = connection;
        run.limitations.push(connection.provider === 'ollama' ? 'Model inference runs on this Mac; no external model API calls or automatic paid fallback.' : 'Brief data is sent to the configured paid model gateway.');
      }
      if (active) return send(res,409,{error:'A run is already working. Wait or stop it first.'});
      const controller = new AbortController(); active = {id:run.id,controller};
      // Local structured generation can take several minutes on a laptop;
      // keep the run local and bounded without forcing a paid fallback.
      const timer = setTimeout(() => controller.abort(), 900000);
      runs.set(run.id,run);
      try { await saveRun(run); } catch { active = undefined; clearTimeout(timer); runs.delete(run.id); return send(res,500,{error:'Could not save the run. No specialists were started.'}); }
      send(res,202,{id:run.id});
      executeRun(run,{generate:generateSpecialist,save:saveRun,signal:controller.signal}).catch(() => { run.status='failed'; run.error='Could not save run evidence. Do not treat this run as approved.'; }).finally(() => { clearTimeout(timer); active=undefined; });
      return;
    }
    send(res,404,{error:'Not found.'});
  } catch { send(res,500,{error:'The studio could not complete the request.'}); }
});
server.listen(port,'127.0.0.1',() => console.log(`Amo Prompt Studio: http://127.0.0.1:${port}`));
for (const sig of ['SIGINT','SIGTERM']) process.on(sig,() => { active?.controller.abort(); server.close(() => process.exit(0)); });
