# App asset delivery

The localhost shell and all seven localhost Apps across four domains use small HTML documents with
normal Vite hash-named JavaScript/CSS and per-domain shared chunks. App assets are
served only on that session's existing isolated proxy listener. There is no CDN,
additional service, runtime npm build, custom module loader or protocol.

The eight self-contained embedded HTML resources (the TopicGraph sitemap is embedded only) remain packaged by their owning
Python runtimes for stock MCP Apps hosts. `ui://` identifies an MCP resource, not
a browser asset mount: registering JS/CSS resources does not make relative
`script src` or stylesheet URLs resolve in stock hosts. This dual delivery is
deliberate, not a legacy fallback.

Embedded stages use the host's advertised container height independently of the
iframe's initial viewport. The SDK reports the resulting document size back to
the host; capping that size with `100vh` would trap an initially collapsed iframe
in a resize feedback loop. The Knowledge Graph Playground retains its own viewport-sized
layout, and narrow layouts retain natural document scrolling.

Each localhost entry is a first-party mapping bound to its domain, server name,
presenter, exact advertised resource URI and SHA-256 of the embedded HTML bytes.
The host still calls the actual server and reads its official resource, validating
identity, MIME, result and declared permissions before selecting the local HTML.
Unknown or changed server documents fail visibly with `ASSET_VERSION_MISMATCH`;
the host never substitutes local code for arbitrary server HTML.

Each domain's `asset-manifest.json` binds its complete emitted file set and the
common source commit/tree/lock, entry mappings, embedded hashes and compressed-size
reports. Startup verifies hashes, matching host/App build identities and these limits:

| Limit | Value |
|---|---|
| Files per domain | 64 |
| Per file | 4 MiB |
| Per domain | 12 MiB |
| Per HTML entry | 8 KiB |
| Reachable compressed JS/CSS, topology and TopicGraph exploration (Reagraph allowed) | 1 MiB |
| Reachable compressed JS/CSS, evidence (no graph renderer) | 200 KiB |

Normal HTTP script/style fetches use only the current App origin; exact manifest
paths, MIME types and same-origin resource policy prevent traversal/unlisted or
other-domain asset access. Release provenance binds every emitted asset.

[Prerequisites and setup](standalone-setup.md) | [Launch](standalone-launch.md)
