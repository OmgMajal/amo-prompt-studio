# v0.1 validation · 2026-10-24

Status: local prototype verified with offline templates and model doubles. Live provider behavior remains unverified.

## User story

A user enters a business brief in the local browser, submits it to the studio API, receives a saved prompt package, and inspects the source brief, role handoffs, assumptions, review findings, and structural checks.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Browser entry | Passed | Local page rendered; `studio-overview.png` |
| Example intake | Passed | Fictional Sunday Crumb brief filled through browser controls |
| Client → API → stored run | Passed | Browser generated `example_only` package; API integration tests verify stored outputs and history |
| Stored run → rendered prompts | Passed | Writing and visual prompt cards with acceptance criteria appeared; `studio-preview.png` |
| Collaboration transparency | Passed for preview | Analyst assumptions, uncertainty, fact IDs, and absence of reported dissent expanded in browser |
| Checks and execution events | Passed for preview | Browser showed source brief and all 11 sequential workflow events; model review clearly marked illustrative |
| JSON export | Implemented; partially observed | Browser export control was exercised without an error. Automated browser download capture was not available in this verification; a separately saved JSON example is included in `examples/` |
| Browser console | Passed | No warning or error entries returned by the browser log check |
| Required-input and origin controls | Passed | Local API tests reject incomplete briefs, cross-origin writes, and live calls without credentials |
| Persistence and restart | Passed in automated fixture | Snapshots retained; unfinished run changed to `interrupted` without automatic resumption |
| Live model boundary | Not tested | No model credentials configured and no live calls executed |

## Automated verification

- `pnpm test`: 16 checks passed; zero failed. See `test-results.txt`.
- `pnpm typecheck`: passed. See `typecheck-results.txt`. TypeScript checks the coordinator entry and typed tool; plain JavaScript files are included for type inference, not fully checked with `checkJs`.
- `pnpm run build:agent`: passed after correcting the instructions definition and renaming the standalone server to avoid eve's reserved server entry discovery. The built output is local only.
- The build warns that the default sandbox has no production provider on this machine. The browser app does not use that sandbox; no claim of a validated production agent runtime is made.
- `agent-build-info.json` records the compiled coordinator, tool input schema, and absence of declared subagents/schedules. Five bounded specialist calls are implemented inside the studio workflow, rather than as separately deployed eve subagent services.
- `model-catalog.json` is the public model catalog downloaded during setup. The configured default ID was present. This is not evidence that the account can call that model.

Workflow tests use controlled doubles to prove handoff order and overlap, fail-closed behavior for unknown fact IDs, dissent preservation, reviewer blocks, cancellation, partial-output retention, and suppression of raw provider errors. They do not assess real AI prompt quality, factual accuracy, or resistance to adversarial business briefs.

## Amo Os preservation

`amo-os-before.json` captured a pre-build inventory. `amo-os-check.json` reports 695 paths, sizes, and modification timestamps unchanged at verification. Exclusions are recorded in that file. No program from Amo Os was run and no intentional write targeted that project. Canonical Foundation identity was not established from the available snapshot copies; they were used only as reference material.

## Next validation

Configure an explicitly chosen model connection locally, authorize a small live test, and run a fictional business brief. Review actual specialist outputs for invented claims, cross-role consistency, useful prompt detail, visible uncertainty, accurate provider usage, cancellation, and real provider errors. Keep live generation labeled unverified until this succeeds. No automatic publication or production launch is part of this version.
