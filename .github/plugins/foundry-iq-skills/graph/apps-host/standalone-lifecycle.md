# Selection, cancellation and shutdown

In the Playground, selecting a graph or schema record selects its evidence.
Embedded hosts keep an explicit **Select evidence** action. Selection uses the
official `updateModelContext` exchange.

Open **Settings**, then expand **Technical details** to inspect the exact packet,
server, session and resource. No agent conversation is connected. The shared views
show chat-specific selection wording only when a host advertises `message.text`;
this viewer never advertises `message.text`, sampling or an agent backend.

**Clear search** sends public `ui/resource-teardown` through the official bridge
while the transport still exists. It waits at most five seconds for the matching
successful response, then removes listeners/frame and releases the session.
Missing, wrong-ID, late or rejected responses produce an explicit teardown error,
not a successful graceful-close claim. Retained graph/evidence sessions are all
released; repeated disposal is idempotent. Closing or reloading the page cannot
wait for teardown, so each mounted App releases its session with a keepalive request
on `pagehide`. **Cancel request** aborts pending work
and clears that tab's results without changing the other tabs.
**Reconnect server** retires that server's old sessions and reconnects explicitly;
there is no CLI fallback or background retry.

Type `quit` and Enter, or press Ctrl+C, in the launcher terminal to stop the
loopback servers and their owned MCP processes. Keep that terminal open while
using the viewer. Closing a browser tab is not the documented host stop operation.
On shutdown the connector stops owned processes, rather than claiming graceful
browser teardown after the browser is gone.

[Prerequisites and setup](standalone-setup.md) | [Launch](standalone-launch.md)
