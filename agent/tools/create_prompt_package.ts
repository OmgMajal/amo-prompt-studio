import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { newRun, executeRun } from '../../studio/engine.mjs';
import { generateSpecialist, connectionStatus, modelSettings } from '../../studio/model.mjs';
import { saveRun } from '../../studio/store.mjs';

export default defineTool({
  description: 'Prepare a prompt package using the bounded studio workflow. Preview uses templates. Live defaults to a local Ollama model without API fees. Explicit gateway configuration uses paid external calls. Output always requires human review.',
  inputSchema: z.object({
    mode: z.enum(['preview','live']),
    brief: z.object({ business: z.string(), niche: z.string(), audience: z.string(), objective: z.string(), voice: z.string(), platforms: z.string(), products: z.string(), constraints: z.string() })
  }),
  approval: ({ toolInput }) => toolInput?.mode === 'live' && modelSettings().provider === 'gateway' ? 'user-approval' : 'not-applicable',
  async execute({ brief, mode }) {
    const run = { ...newRun(brief, mode), connection: mode === 'live' ? await connectionStatus() : null };
    if (run.connection && !run.connection.ready) return { error: run.connection.message };
    return await executeRun(run, { generate: generateSpecialist, save: saveRun, signal: AbortSignal.timeout(300000) });
  }
});
