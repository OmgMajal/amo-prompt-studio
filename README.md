# Amo Prompt Studio · v0.3

Owner: Amo. Built 2026-10-24. Status: local prototype. Free local model integration is now the default; see the latest evidence in `evidence/FREE_LOCAL_TEST.md`.

A business brief becomes a coordinated, platform-aware package of writing, visual, script, and community prompts. The studio creates the instructions for future content creation. It does not create final captions or images. Optional web research collects source candidates for analysis; it does not turn search snippets into business facts or publish anything.

## Platform-aware generation

The `studio/platforms.mjs` registry normalizes human platform text into versioned targets such as Instagram/Reel, TikTok/Video, YouTube/Short, LinkedIn/Post, Twitch/Stream, and Discord/Announcement. Each target carries asset types, format guidance, and acceptance criteria. The original brief remains the source of truth; registry guidance is a prompt-generation aid, not a publishing integration.

Every missing detail is represented by a shared confirmation token such as `[CONFIRM: schedule]` or `[CONFIRM: tournament rules]`. Copy, format, and visual specialists must carry the same tokens for every target, and the engine checks target coverage before the reviewer runs.

When **Use optional web research** is enabled, the studio creates bounded queries from the niche, audience, and selected targets. It saves source URLs, snippets, query text, retrieval time, and an unverified status. The research analyst separates observations from inference and gives the strategist evidence to assess. Search failures do not create invented facts; they remain visible as unavailable research. Research is opt-in because the brief may contain sensitive or proprietary information.

Completed runs also contain a deterministic `compound` package. It bundles the source brief, governance fields, shared requirements, strategy summary, target matrix, writing prompts, visual prompts, format/channel prompts, reviewer result, registry version, and a publication-disabled declaration. The browser evidence tab shows this bundle summary, and JSON export preserves the complete package.

The evidence tab also records platform evaluations for every copy/format/visual target. The package can be exported as complete JSON or as a human-readable Markdown production sheet from `/api/runs/<run-id>/compound.md`.

## Try the studio

Open `http://127.0.0.1:4310` while the server is running. Click **Try an example**, then **Create prompt package**. The example business is fictional.

To restart on this Mac, double-click `Start Studio.command`. This uses the bundled Node runtime if normal Node is unavailable. Keep the terminal window open. Closing it stops local access. If macOS prevents launching the file, run the server from a terminal instead; do not bypass an OS security warning.

With Node.js 24+ and pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Use Node.js 24+ from your normal installation or package manager. Dependencies are installed with pnpm.

## What the team does

| Role | Responsibility | Handoff |
| --- | --- | --- |
| Brief analyst | Identify supplied facts, objective, audience, gaps and assumptions | Shared intake |
| Research and evidence analyst | Assess opt-in web-search candidates and provenance | Source observations, uncertainty and verification questions |
| Campaign strategist | Propose a coherent campaign direction using intake | Shared strategy |
| Writing prompt specialist | Prepare caption-generation instructions | Writing prompts and acceptance criteria |
| Visual prompt specialist | Prepare image-generation instructions aligned to strategy | Visual prompts and acceptance criteria |
| Format and channel specialist | Adapt the request to each target's production shape | Scripts, sequences, accessibility and handoff prompts |
| Independent reviewer | Critique submitted work without rewriting it | Findings and review decision |

The analyst runs first. If research is enabled, the web boundary and research analyst run before strategy; otherwise the strategist works from the brief alone. Writing, format, and visual calls run concurrently, using the same analyst, research (when enabled), and strategy snapshot. The reviewer receives all three outputs. In live mode, specialists are separate model calls with distinct instructions to the same configured model. “Independent” describes separation from the generation calls; it does not mean a different model, provider, or independent human judgment.

## Honest collaboration

`studio/rules.mjs` is the shared runtime contract. Every role reports its summary, fact references, assumptions and their basis, uncertainties, disagreements, deliverables, and review decision. User-supplied facts remain explicitly unverified.

The engine rejects unknown fact IDs and malformed or missing deliverables. A reviewer block stops progression. A request for changes or any reported disagreement prevents progression to human review. The engine retains all submitted role outputs and events; the reviewer cannot overwrite the writers' work through its output. Missing information must remain visible in prompts as `[CONFIRM: detail]`.

These are safeguards, not a guarantee of truth. Fact references prove only that a recognized brief field was cited. They do not establish that a model accurately interpreted it. The system cannot detect all invented claims or hidden contradictions. A model pass always means **human review needed**, never approval or production readiness. Saved JSON is a local record, not a signed or tamper-proof audit log.

## Free local AI (default)

The studio uses the installed Ollama service and downloaded `qwen3:4b` model on this Mac. No API key, payment method, or cloud model account is needed. The model has no API fees; electricity and use of your hardware still have a cost. Local inference can be slower and less capable than larger hosted models.

The launcher starts Ollama if needed with cloud disabled, bound only to `127.0.0.1:11434`, a 16K context and one inference slot to fit memory. Writing, format, and visual requests can be submitted together, but the local model processes them one at a time. The specialist roles share one model; they are not six or seven separate model installations.

Local configuration in `.env`:

```ini
STUDIO_PROVIDER=ollama
STUDIO_LOCAL_MODEL=qwen3:4b
PORT=4310
```

The browser checks that this model is downloaded before enabling real specialists. Remote/cloud model records are rejected in local mode. If the local server fails, the run stops; it never falls back to a paid model. On another computer, install Ollama and download `qwen3:4b` first. No additional download was needed on this Mac.

## Preview and live modes

**Template preview** is fully offline. Fixed templates adapt to brief fields. No AI specialist or AI review runs. The final status is always `example_only`, and the illustrative reviewer always requests human checks. Preview remains usable without credentials.

**Live specialists** runs actual model calls locally by default. Local calls use schema-constrained JSON and role-specific checks; the local Ollama request uses a bounded 1,800-token generation budget. An optional **paid gateway** is used only if you explicitly set `STUDIO_PROVIDER=gateway`. To opt into that separate paid route, enter your own `AI_GATEWAY_API_KEY` locally, choose `STUDIO_MODEL`, and restart the server. Do not send keys in chat or reuse credentials from another project. The default model ID was tested locally; larger-model suitability remains unverified.

Each browser run has six specialist calls by default, or seven when optional web research is enabled. There is no automatic retry, three concurrent drafting calls, and a bounded fifteen-minute timeout for slow local hardware. One browser run can execute at a time. These are execution bounds, **not a dollar spending cap**. Prices and provider billing are not calculated. Live mode is opt-in and displays the local-model notice. Stop attempts to cancel in-flight calls; local compute may continue briefly while a request is being cancelled.

The initial version was validated only with templates and doubles. A subsequent real local test is recorded separately in `evidence/FREE_LOCAL_TEST.md`, including failures and review findings. The paid gateway route remains untested. Small-model quality and adversarial behavior are not guaranteed.

## Working with results

- **Prompt package:** inspect writing, visual, and format/channel prompts, acceptance criteria, and reviewer findings; copy individual prompts.
- **Collaboration:** inspect each role's handoff, assumptions, uncertainty, and dissent.
- **Checks & evidence:** inspect structural checks, the exact saved source brief, and timestamped execution events.
- **Export package:** download the complete run as JSON, including prompts and review evidence. The saved example is also in `examples/sunday-crumb-preview.json`.
- **Recent runs:** reopen locally saved packages. Edit the brief and start a new run to address findings; automatic revision loops are outside v0.2.

Runs are saved under `.studio/runs/` using restricted filesystem permissions and serialized atomic file replacements. This is plain local JSON, not encrypted storage. Use fictional or non-sensitive briefs in this prototype. A server restart marks unfinished runs `interrupted`; it never silently resumes or approves them. Keep `.studio/` if you need run history, or export packages before moving computers. There is no automatic backup or remote synchronization.

## Optional eve coordinator

The project includes a compiled eve coordinator exposing the same bounded studio workflow as a typed tool:

```sh
pnpm agent
```

This is a separate terminal interface. Its coordinator now uses local Ollama, without API fees. Local specialist tool calls require the downloaded model to be running. Optional paid-gateway specialist calls require `AI_GATEWAY_API_KEY` and a per-call approval in eve. The standard command disables bundled development extensions and self-modification; optional default tools and root-copy delegation are disabled in agent configuration. Do not run `eve dev` without the supplied flags if you want those development extensions disabled.

The coordinator build passes. Interactive coordinator behavior was not tested with a model. Its production build emits a warning because this computer has no Docker or Vercel sandbox provider; production deployment was not validated. The local browser app does not require a sandbox provider and is launched separately with `pnpm start`.

## Verification and acceptance

```sh
pnpm test
pnpm typecheck
pnpm run build:agent
```

Acceptance criteria for this version:

1. A complete fictional brief produces writing, visual, and format/channel prompt templates plus a visible illustrative review, without network model calls.
2. Analyst and strategy dependencies run in order; writing, visual, and format work can overlap; review waits for all three. Validated using injected model doubles, not live providers.
3. Unrecognized fact references, missing prompts, reviewer blocks, dissent and cancelled runs cannot become approved packages.
4. Stored partial work survives restart, with interruption clearly disclosed.
5. The browser displays source context, assumptions, handoffs and limitations; prompts and their record are exportable.
6. Missing model credentials prevent live generation; cross-origin requests are rejected; the server binds only to `127.0.0.1`.
7. Amo Os reference files remain unchanged.

Evidence and precise verification limits are recorded in `evidence/VALIDATION.md`. This app has no authentication or multi-user isolation and must remain local; public hosting is outside this version.

## Amo Os reference boundary

Only reference documents were read. No Amo Os program was executed. No files, registers, Git history, or project configuration were changed there.

The project folder contains multiple candidate and clean-clone snapshots. The runtime clean-clone copy reports version 0.4, while an earlier docs copy reports version 0.2 with different capability statuses. Neither was established as the current canonical Foundation. They were used only as reference evidence for owner authority, explicit uncertainty, provenance, and completion checks. Their capability claims were not imported into this studio.

Reference-only Amo Os files consulted during development:

- `.runtime-v0.1-clean-clone-test-46NwMN/AGENTS.md`
- `.runtime-v0.1-clean-clone-test-46NwMN/README.md`
- `.runtime-v0.1-clean-clone-test-46NwMN/05-operations/DEFINITION_OF_DONE.md`
- `.runtime-v0.1-clean-clone-test-46NwMN/02-governance/SOURCE_OF_TRUTH_POLICY.md`
- `.phase5a-build/docs/AGENTS.md`
- `.phase5a-build/docs/README.md`

`evidence/amo-os-check.json` compares 695 reference-file paths, sizes, and modification times against the pre-build inventory. It is a metadata comparison, not a byte-for-byte cryptographic audit.
