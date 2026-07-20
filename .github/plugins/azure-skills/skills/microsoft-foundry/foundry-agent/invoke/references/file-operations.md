# Hosted Session File Operations with azd

Use `azd ai agent files` to manage files in a Hosted Agent session.

## Resolve the Session

File commands use the last session saved by `azd ai agent invoke` or `azd ai agent sessions create`. Use `--session-id <id>` to select another session. Use `--agent-name <service-name>` when the project has multiple agent services.

Run a successful invoke first unless files must be uploaded before the first request. In that case, create a session explicitly and use the returned `agent_session_id`.

## Commands

Upload a local file. The remote path defaults to the local filename:

```bash
azd ai agent files upload ./input.csv
azd ai agent files upload ./input.csv --target-path /data/input.csv
```

Download a remote file. The local path defaults to the remote basename:

```bash
azd ai agent files download /data/output.csv
azd ai agent files download /data/output.csv --target-path ./output.csv
```

List paths and inspect metadata:

```bash
azd ai agent files list
azd ai agent files list /data --output table
azd ai agent files stat /data/output.csv
```

`mkdir` will not automatically create missing parent directories. Create each missing parent directory first:

```bash
azd ai agent files mkdir /data
azd ai agent files mkdir /data/input
```

Delete a file or directory:

```bash
azd ai agent files delete /data/old.csv
azd ai agent files delete /data/temp --recursive
```

Recursive delete must be explicit. Do not add `--recursive` unless deleting the directory and all contents is intended.

## Upload, Invoke, Download

```bash
azd ai agent sessions create
azd ai agent files mkdir /data/input
azd ai agent files upload ./input.csv --target-path /data/input/input.csv
azd ai agent invoke "Process /data/input/input.csv and write /data/output/result.csv"
azd ai agent files stat /data/output/result.csv
azd ai agent files download /data/output/result.csv --target-path ./result.csv
azd ai agent sessions stop <session-id>
```

The create command persists the new session, so the later file and invoke commands reuse it without repeating `--session-id`.

## Filesystem Rules

Hosted session files persist under `$HOME` for the session lifetime. Files outside `$HOME`, such as `/tmp`, are ephemeral. Deleting the session permanently removes its persistent filesystem.

## Error Handling

| Error | Resolution |
|-------|------------|
| No saved session | Run `azd ai agent invoke`, create a session, or pass `--session-id` |
| Session is stopped or missing | Run `azd ai agent sessions show <id>` or `list`; invoke to resume a stopped session |
| File not found | Use `azd ai agent files list` and `stat` to verify the path |
| Directory is not empty | Repeat delete with `--recursive` only after confirming the intended path |
| Header-based isolation fails | Pass the same `--user-identity` used for invoke and session commands |
