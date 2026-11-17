# Installed independent MCP Apps host

Quick start: from your workspace folder, run
`python -I "<installed plugin>\graph\runtime\bootstrap.py" run entity graph-playground`
([details](standalone-setup.md)). The rest of this guide is for operators.

Install the complete Foundry IQ skills plugin, configure its existing Apps
runtimes, run the packaged launcher, and open its printed loopback URL in a normal
browser. No separate archive, repository checkout, npm install or consumer build
is required. Ordinary skills remain CLI-first.

This viewer supports four MCP Apps domains: Entity Graph, TopicGraph, ontology and grounding.
It connects to configured servers using the official MCP
client and validates their advertised HTML before loading the matching packaged
localhost App through the official Apps host bridge. The same canonical UI source
produces both deliveries; there is no second domain implementation or CLI fallback.

## Start here

1. Check the [platform prerequisites and explicit runtime setup](standalone-setup.md).
   Use Python 3.12, 3.13 or 3.14 with `-I` for bootstrap setup/status/run and configured pip sources.
2. Save the [operator JSON](standalone-configuration.md) outside the installed plugin
   and source control; configure only the domains needed.
3. Follow the [scope, environment and launch instructions](standalone-launch.md)
   with an explicit Node 22.13+ executable. Open the full printed `127.0.0.1` URL,
   including the part after `#`.
4. [Explore the Knowledge Graph Playground](standalone-workspace.md). Keep the launcher terminal open;
   type `quit` and Enter or press Ctrl+C there to stop owned processes.

Setup is explicit; warm launch never installs packages. No model-backed conversation
is attached to this host.

## Complete guide

- [App asset delivery](standalone-delivery.md)
- [Prerequisites and runtime setup](standalone-setup.md)
- [Operator configuration example](standalone-configuration.md)
- [Scope, environment and launch](standalone-launch.md)
- [Knowledge Graph Playground and query modes](standalone-workspace.md)
- [Graph, table and evidence inspection](standalone-inspection.md)
- [Selection, cancellation and shutdown](standalone-lifecycle.md)
- [Protocol, tool policy and resource bounds](standalone-protocol.md)
- [Process ownership and sandbox isolation](standalone-isolation.md)
- [Errors](standalone-errors.md)
- [Contributor build and immutable export](standalone-build.md)

All linked pages ship beside this README and are bound by `payload-provenance.json`.
