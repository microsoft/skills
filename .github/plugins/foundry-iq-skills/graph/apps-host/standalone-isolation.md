# Process ownership and sandbox isolation

Windows creates each server atomically in a kill-on-close Job Object through the
packaged standard-library supervisor; descendants remain owned after root exit.
MCP stdin belongs to the real server. A parent process handle, not a second stdin
reader, watches connector death. Failed supervision/cleanup is explicit and
never falls back to an unsupervised process. Operators trust installed runtime
code: this is not an operating-system sandbox for arbitrary executable bindings.

On macOS/Linux the same supervisor uses `subprocess.Popen(start_new_session=True)`
and standard process-group signals, never a replacement MCP transport. Termination
is blocked across creation until cleanup handlers exist; the child restores its
signal mask before exec. Stop sends SIGTERM only to that owned group, waits
0.5 seconds, then uses SIGKILL if necessary. The supervisor retains ownership
after root exit and observes parent death. An uncatchable SIGKILL of the POSIX
supervisor itself cannot run cleanup; unlike Windows kill-on-close jobs, POSIX
process groups do not provide that kernel lifetime guarantee.

The host and every App session's sandbox proxy use distinct loopback ports/origins.
Different App sessions never share a proxy security origin. The maintained official
basic-host two-iframe arrangement is adapted only where the SDK provides no
complete sandbox implementation. The App `srcdoc` has URL origin `null` but an
effective security origin inherited from the proxy; the host remains cross-origin.
Relays require both the exact source window and origin. Same-origin cloned sibling
frames cannot inject App messages, and one App cannot read or execute in another
App's proxy/document. The App can access its own proxy, not the host DOM,
launch token or authenticated connector.

Resource CSP is taken from the actual server document and validated before
embedding. The localhost variant additionally permits its own isolated origin
for packaged script/style resources, not for network connections. Current Apps declare empty network/frame permissions. HTTPS declared
resource/connect origins may be honored; nested frame/base delegation, workers,
device/clipboard/download grants and connector-origin access are not supported.
No `unsafe-eval` or token is injected into App HTML. The connector enforces exact
Host/Origin, same-origin bootstrap that also requires the per-launch key from
the printed address, session token, request/cancel UUID correlation and replay
rejection, with no CORS grants. Logs contain bounded metadata only,
not arguments, evidence, environment, token or raw server stderr.
The trusted host's frame CSP permits loopback ports to accommodate per-App origins;
each App's inherited frame CSP remains restricted to its own proxy origin.

[Prerequisites and setup](standalone-setup.md) | [Launch](standalone-launch.md)
