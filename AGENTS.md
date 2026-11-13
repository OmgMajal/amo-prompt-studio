# Amo Prompt Studio

Owner: Amo. This project creates prompts, not final marketing assets.

- Amo requires operation without paid model APIs. Default to the downloaded local Ollama model. Do not switch to a paid provider, add billing, or fall back to external inference without a new explicit user request.

- Make all changes inside this project. Amo Os is read-only reference material; never run its tools, update its registers, or change its files.
- Keep the honesty contract in `studio/rules.mjs` authoritative for runtime instructions. Do not duplicate a different version in specialist code.
- Preview uses fixed templates and must always be labeled as such. Never call it an AI run or independent review.
- Live mode uses separately prompted calls to the same configured model. Human review remains mandatory.
- Preserve fact provenance, assumptions, uncertainties, disagreements, failures, and partial outputs. Never promote a model pass to human approval.
- No publishing, social account access, financial actions, or recurring automation. Optional web research is bounded, opt-in, and preserves sources as unverified candidates.
- Keep provider credentials in local environment configuration. Never copy credentials from other projects.
- Validate with the engine tests, agent build, and browser workflow. Provider integration must remain labeled unverified until a live call is tested with authorized credentials and spend.
