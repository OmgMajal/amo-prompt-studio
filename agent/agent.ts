import { defineAgent } from 'eve';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const local = createOpenAICompatible({ name: 'ollama', baseURL: 'http://127.0.0.1:11434/v1', includeUsage: true });

export default defineAgent({
  model: local.chatModel(process.env.STUDIO_LOCAL_MODEL || 'qwen3:4b'),
  modelContextWindowTokens: 16384,
  description: 'Amo Prompt Studio coordinator. Prepares prompt packages through a bounded specialist workflow.',
  defaultTools: false,
  tool: false,
  limits: { sessionUsage: ({ window }) => window.inputTokens >= 80000 || window.outputTokens >= 12000 }
});
