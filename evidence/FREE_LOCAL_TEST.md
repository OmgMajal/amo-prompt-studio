# Free local AI validation · 2026-10-24

The user required the specialists to run without paid APIs. The studio now defaults to Ollama using the already-downloaded `qwen3:4b` model on this 16 GB Apple Silicon Mac. No model download, account, payment method, or key was needed for this test. Inference has no API fees, but uses the computer's resources and electricity.

## Actual test evidence

- Fictional business: Sunday Crumb, a neighborhood bakery.
- Objective: encourage local residents to visit for weekend breakfast.
- Platforms: Instagram feed and Stories.
- Unprovided facts: opening hours, pricing, approved photographs and product references.
- First attempt: several roles returned identical generic responses. The reviewer did not supply a valid review verdict, so the run failed. Evidence retained in `free-local-first-attempt.json`; it was not counted as successful collaboration.
- Correction: each local call now has a role ID fixed by its JSON schema. Analyst, strategy and review roles must have empty prompt deliverables. The reviewer must return a real decision. Role-specific tasks are emphasized separately from prior handoff data.
- Second attempt: `e6bc5807-bd0c-473d-93f1-1e7f2621c9b3`.
- Duration: 83.281 seconds from queue creation to final saved run.
- All five actual model calls completed: brief, strategy, visual, copy, review.
- Delivered two writing prompts and two visual prompts, with acceptance criteria.
- Final status: `changes_requested`.
- Reviewer decision: `request_changes`. It identified inconsistent treatment of opening hours and approved product references, plus unverified product-availability and audience assumptions.
- No human approval or publishing occurred. A completed workflow is not a claim that its draft content is correct or professionally ready.

The full run, original brief, actual outputs, per-role token counts, elapsed durations, and review findings are saved in `free-local-bakery-run.json`. The run is also available in the studio's local history. Each role records provider `ollama` and API cost `0`; requests were sent only to the loopback server at `127.0.0.1:11434`. The Ollama server was started with `OLLAMA_NO_CLOUD=1` and reported `Ollama cloud disabled: true`.

## Controls and limits

- Local inference is the default even if a paid key happens to exist in the environment.
- Paid gateway requires an explicit provider change; it is not a fallback. The user's no-paid-API requirement is recorded in `AGENTS.md`.
- Local mode checks for a downloaded model and rejects remote/cloud model records.
- The server binds to loopback. No public hosting or external model service is required.
- Each local response is constrained by the role's JSON schema and validated afterward.
- Local calls use a bounded context, non-thinking mode, an 1,800-token output cap and no automatic retries.
- The launcher uses one local inference slot to fit memory. Drafting requests can overlap at orchestration level, but actual model computation queues on this one model.
- The local run bound is now 15 minutes so a slow laptop inference cannot be mistaken for a paid-provider failure; cancellation remains available.
- There is no independent second model or human reviewer in this test. Small-model limitations remain; the reviewer can miss issues. The strategy's proposed “Weekend Sip & Sourdough” angle could imply an unprovided beverage offering, which the model reviewer did not specifically flag. Human review remains necessary.

## Software checks

Current implementation status: 28 automated checks pass, including platform-target expansion, explicit research preview behavior, and deterministic shared-confirmation enforcement. Corrected FIFA live run `1e78771a-ff48-4ea8-9eb4-a461bb1eb4e6` reached `human_review`; earlier failed attempts remain preserved as evidence.

Expanded six-role verification: fictional FIFA Night Hub run `bdb35c2c-c191-4710-8bdc-69420af03df6` completed locally on 2026-10-25 using one Instagram/Reel target. Brief, strategy, writing, visual, format/channel, and review calls all completed. The reviewer returned `pass`; all seven structural checks passed; status was `human_review`. The run included governance fields (approval owner, success check, risk notes, validation plan), three platform evaluations, and a compound package. This confirms the expanded format specialist with real local inference, but it remains human-review work and not approval.

Research-enabled verification: fictional FIFA Night Hub run `a1a035e0-33d0-429f-b049-d145d9632c3a` completed locally with the optional web-research path enabled and one TikTok target. The web boundary recorded its query and an explicit `no_results` status without inventing sources; the research analyst, strategist, writing, visual, format, and reviewer calls still completed. The reviewer returned `request_changes`, so the final status was `changes_requested`. This is the expected honest outcome when the model reviewer asks for clarification; it is not approval. A local mock endpoint test separately confirmed source capture with URL, snippet, query, retrieval time, and `unverified_search_result` provenance.

Structured strategy verification: fictional FIFA Night Hub run `64999d29-da4d-4e7f-a5e1-f34bad062161` completed on local Ollama with one Instagram/Reel target. The strategist returned one structured platform plan with four content needs; writing, visual, and format prompts consumed that plan; the reviewer returned `pass`; all structural checks passed; final status was `human_review`. This verifies the requested sequence of strategy → content needs → prompt generation.

21 automated checks pass, including shared confirmation extraction, local-only request routing, rejection of remote/cloud aliases, zero API-cost labeling, and no paid fallback when local inference fails. Type checking passes. The post-review reruns were preserved: `51537733-6db6-4ce2-b1f0-481bc1ee1514` stopped at the new alignment gate because visual language contradicted approved references; `75ce168a-a1bd-4891-95a2-c5acbc621793` reached both deliverables but stopped at the same gate because the visual prompt omitted the exact opening-hours token; `c222c1ff-31df-4e52-baf4-eb5067e42175` and `905620bd-6640-4c5f-8291-e6bf56bef1e0` were safely cancelled after the local visual call exceeded practical laptop latency. None was approved or published. Production sandbox setup is still unverified and is not needed for the local browser workflow.

The earlier `VALIDATION.md` records the original preview-only version. This file supersedes its statement that no live calls had been tested for the local Ollama route only; the paid gateway still has not been tested.

## Using it

Open the local studio and select **Live specialists · Local AI · No API fees**. It is selected by default when the local model is available. Use `Start Studio.command` to restart on this Mac; it starts the installed Ollama service if necessary. No system startup job, recurring schedule or new paid account was created. Amo Os was not modified.
