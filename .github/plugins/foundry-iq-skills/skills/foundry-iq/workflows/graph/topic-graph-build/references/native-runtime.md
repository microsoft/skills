# Native Topic Graph runtime

`topic-graph-build` downloads and verifies the native **topicGraphBuildTool** binary on first use, after you approve
the download on the plan card. Nothing to install. It comes from the public GitHub repository
`Azure/foundry-iq-tool-releases`; the Python wheels have no clustering fallback and bundle no executable.

| Native RID | Release asset | Executable |
|---|---|---|
| `win-x64`, `win-arm64` | `topicGraphBuildTool-<version>-win-<arch>.zip` | `topicgraph.exe` |
| `linux-x64`, `linux-arm64` | `topicGraphBuildTool-<version>-linux-<arch>.deb` (read rootless, no `dpkg`) | `topicgraph` |

The native Topic Graph build isn't available on macOS; it fails with `NATIVE_PLATFORM_UNSUPPORTED`.

## Download and verification

1. **Plan.** With no verified binary cached, `topic-graph-build plan` (or `download-native`) adds a download step
   naming the pinned repository, release tag, asset and `sha256:` digest. If no release resolves, `plan` stops
   before approval.
2. **Download.** `apply` (or `download-native --approve-download --plan-id <id>`) checks the `sha256:` digest
   before extraction, checks the executable against the package's `checksums.sha256`, and writes `receipt.json`
   with the executable's SHA-256. The cached binary is reused while
   the pin matches, without calling GitHub; a newer release waits for a plugin update. `NATIVE_RELEASE_MISMATCH`
   means the published asset no longer matches the pin: report it, don't retry. The release lookup uses
   `GITHUB_TOKEN` when it's set, and waits and retries when GitHub rate-limits it; `NATIVE_RELEASE_RATE_LIMITED`
   means the limit outlasted the retries.
3. **Run.** Every native call re-checks the executable against the `receipt.json` of the pinned release.
   `NATIVE_BINARY_CHECKSUM_REQUIRED` means the pinned release isn't downloaded; `BINARY_HASH_MISMATCH` means
   the executable isn't the pinned one. An unknown output schema fails with `NATIVE_SCHEMA_VERSION_UNSUPPORTED`.

Never bypass verification, synthesize native outputs or substitute another binary.

## Overrides (dev)

The cache is `%LOCALAPPDATA%\foundry-iq-skills\runtimes\topicgraph\native` on Windows and
`~/.cache/foundry-iq-skills/runtimes/topicgraph/native` elsewhere; `TOPICGRAPH_NATIVE_CACHE` or
`FOUNDRY_IQ_RUNTIME_CACHE` moves it. When that folder isn't writable (a sandboxed harness), it falls back
to a private per-user temp folder and prints one `Foundry IQ:` note. In a sandbox, set
`FOUNDRY_IQ_RUNTIME_CACHE` to an absolute path inside the writable roots instead: a private temp subfolder
or a git-ignored workspace folder, never inside the plugin. Don't ask for broader permissions. The launcher uses the first binary it finds, and verifies it against the
pinned release, so an override must be a copy of the pinned executable:

1. `--native-binary <absolute path>`.
2. `TOPICGRAPH_BUILD_BINARY`, then `TOPICGRAPH_NATIVE_BINARY`.
3. The pinned release in the cache.
4. On Linux, `/usr/bin/topicgraph`.
5. `topicgraph` (or `topicgraph.exe`) on `PATH`.
