# Errors

Missing runtime payload, Python, verified bootstrap setup or a supported MCP
version prevents readiness. Inspect bootstrap `status` and complete `setup`
with configured pip sources; do not point the host at an old console executable or
remove negotiation/sandbox checks. Domain failures and disconnected servers are
visible, not empty successful graphs. A cancelled server needs explicit reconnect.

`PROTOCOL_UNSUPPORTED` identifies an explicit incompatible version reply.
`NEGOTIATION_FAILED` means discovery did not establish protocol support: check
bootstrap setup and server startup/dependency failures, not just SDK versions.
The pinned protocol and no-fallback policy are unchanged. Owned servers run the
`server/discover` probe in place on the one supervised process, so startup
diagnostics cover the process that failed. `NEGOTIATION_FAILED`,
`APPS_UNAVAILABLE` and `PROTOCOL_UNSUPPORTED` messages end with a bounded
(at most 20 lines, 2 KiB), redacted tail of that server's stderr (tokens, keys,
signatures, URL query strings and the home directory are masked), or state that
the server wrote none. Logs keep byte counts only; the full retained tail stays a
private, non-enumerable property of the error.

After install or upgrade, each runtime's Python environment is built on first use.
Sources still preparing (`RUNTIME_PREPARING`), even all of them, do not stop
launch: the launcher prints ready plus a `Not ready yet` line, and each view shows
**Preparing…** with Reconnect. They come online by themselves within minutes. To
pre-warm, run `python -I "<plugin>/graph/runtime/bootstrap.py" setup <domain>`.
After 10 minutes a source still preparing becomes `RUNTIME_NOT_READY`: its view
says it still isn't ready, with that command and any setup log bootstrap named.

[Prerequisites and setup](standalone-setup.md) | [Launch](standalone-launch.md)
