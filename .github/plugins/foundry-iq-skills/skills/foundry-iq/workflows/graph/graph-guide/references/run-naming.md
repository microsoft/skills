# Run naming

Use one saved naming context for the demo or a standalone workflow. Ask for a
short label, such as `travel`, `finance` or `mydocs`; propose a corpus-derived
default if none was given. Do not put personal information or document text in
resource names.

## Start, join and resume

Use the packaged launcher from [runtime setup](install-and-checks.md#plugin-and-clis).
This offline command starts a fresh run and writes only local naming metadata:

```text
python -I "<package-root>\graph\runtime\bootstrap.py" run entity entity-graph-provision name --run-name travel --output-root "<cwd>\.foundry-iq" --json
```

Keep its `run_naming.prefix`, `resource_names`, `run_directory`, `state_root`
and `provision_state_dir`. The prefix is `fiq-<label>-<8 lowercase hex>`;
labels normalize to lowercase ASCII letters, digits and single dashes, with
1-24 characters after normalization. Two new runs with the same label get
different prefixes. Never invent the random suffix or regenerate it mid-run.

Pass `--run-prefix <resolved-prefix>` and the returned `--state-dir
<provision_state_dir>` to provisioning or connect. For creation, missing
resource names default from the prefix; explicit names and existing resources
are retained. Connect saves versioned `run_naming` metadata and the exact
prefix in `build-args.json`. Pass that binding to subsequent stages rather
than reconstructing deployment or naming flags.

Standalone entry points can start with `--run-name <label>` or join with
`--run-prefix <resolved-prefix>`:

| Entry point | Where the naming context is saved |
|---|---|
| `entity-graph-provision plan` or `connect` | Parent of `--state-dir` (the provisioning journal folder); default `.entity` |
| `entity-graph-build plan` | Parent of `--build-journal`; default `.entity` |
| `topic-graph-build ... plan` | `--state-dir`; put naming/global flags **before** the verb |
| `ontology-build connect` | `--state-dir` |
| `grounding-provision create` or `grounding-build plan` | `--run-state-dir`; default `.grounding` |

Reuse that state directory and binding when resuming. `run-naming.json` freezes
the resolved context; conflicting labels or prefixes are rejected. A new run
needs a new state directory.

After the first command, keep passing `--run-prefix <resolved-prefix>` and the
same absolute state directory. If `Run naming: minted <prefix>` appears mid-run,
stop and rejoin with the original prefix.

## Artifact roles

For prefix `fiq-travel-12345678`:

| Artifact | Name |
|---|---|
| Resource group, Search, OpenAI | `<prefix>-rg`, `-search`, `-openai` |
| User-assigned Search identity (opt-in only) | `<prefix>-identity`; by default Search uses its system-assigned identity |
| Entity Knowledge Source | `<prefix>-entity-<generation>` |
| Entity content and graph indexes | Knowledge Source name plus `-index` and `-graph-index` |
| Knowledge Base | `<prefix>-kb-<generation>` |
| Topic index | `<prefix>-topics-<native-content-id>` |
| New topic retrieval profile | `<prefix>-retrieval-<vector-hash>` |
| Grounding index | `<prefix>-grounding` |
| Staged Entity files | `<container>/<Knowledge Source name>/...`; trials add `trial/` |

Storage and cache accounts require compact lowercase alphanumeric names of
at most 24 characters. Use the returned hashed suggestions (`st` and `ca`
suffixes), not a manually stripped prefix.

## Local layout

For the demo, keep the corpus, exports and separate `entity`, `topics`,
`ontology` and `grounding` state folders beneath the returned `run_directory`.
Use `topics` and `ontology` as the respective `--state-dir`, and `grounding` as
`--run-state-dir`. Keep descriptor and plan paths as the commands return them.

## Other runs on the same service

Several runs can share one Search service. Check the prefix before retiring a
generation; retire another run's resources only with that run's own
`--run-prefix` and state directory. Naming never grants access or approves writes.
