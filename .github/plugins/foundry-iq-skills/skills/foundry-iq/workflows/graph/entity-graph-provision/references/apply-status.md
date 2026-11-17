# Status while apply runs

## Quick starts

- "Everything ok?" or "What are we waiting on?" while `apply` runs.

## Progress

Don't quote a duration; Azure sets the pace, and a new Azure OpenAI account alone can take 15 minutes or more. Apply first prints the path of its run journal (`.entity/provision-runs/<run>.json`), then `Starting:` and `Done:` per step, and `Still waiting on Azure: <step> (<n> min so far)` every minute while one step runs. If the shell outlives `initial_wait`, keep waiting on it; never start apply again.

## Answer status from the journal

Never answer only "still running". Read the shell's latest lines and that run journal, then report every resource by kind and name (for example "Azure OpenAI account `<oai>`", "chat deployment `chat`", "role grant on the Search service"; the name ends its `resource_id`), never an operation key:

| Journal `status` | Say |
|---|---|
| `create_response_verified`, `verified` | created and checked |
| `existing` | already there, kept |
| `uncertain` with "create attempted; outcome not confirmed", run not finished | Azure is still creating it, since `updated_at` |
| `pending` | not started; waits on its `depends_on` |
| `failed`, or `uncertain` after the run finished | stopped; give its `reason` |

For Entity Graph `verify` or `attach-ontology`, follow `entity-graph-build`'s status guidance: quote the command's latest progress line, or run `entity-graph-build progress --descriptor <published descriptor>`. A `Search asked for a retry … rerunning the indexer` line there is normal, not a failure. End with what is still pending and what it waits on. A long create is not a failure; a run with `completed: false` and `finished_at` set is.
