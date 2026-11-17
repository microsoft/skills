import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { installedConfig, validateConfig, connectRuntimes, startServer } from './connector.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error('Standalone requires Node 22.13 or later; choose a supported executable without changing shared defaults.');
  process.exitCode = 1;
} else if (process.argv.length !== 4 || process.argv[2] !== '--config') {
  console.error('Usage: node "<installed-plugin>\\graph\\apps-host\\launch.mjs" --config "<operator-config.json>"');
  process.exitCode = 1;
} else {
  let runtime, server, terminal, shuttingDown = false, startupComplete = false;
  const startupAbort = new AbortController();
  let count = 0;
  const log = event => { if (count++ < 200) console.error(JSON.stringify(event)); };
  const pluginRoot = fileURLToPath(new URL('../../', import.meta.url));
  const setup = domain => `python -I "${join(pluginRoot, 'graph', 'runtime', 'bootstrap.py')}" setup ${domain}`;
  async function close() {
    if (shuttingDown) return;
    shuttingDown = true;
    terminal?.close(); process.stdin.destroy();
    try {
      if (server) await server.close();
      else if (runtime) await runtime.close();
    } catch {
      console.error('Apps host shutdown failed: an owned server process tree did not close cleanly.');
      process.exitCode = 1;
    }
  }
  function requestShutdown() {
    startupAbort.abort();
    if (startupComplete) void close();
  }
  process.on('SIGINT', requestShutdown);
  process.on('SIGTERM', requestShutdown);
  try {
    const configPath = resolve(process.argv[3]);
    const config = validateConfig(await installedConfig(JSON.parse(await readFile(configPath, 'utf8')), pluginRoot, dirname(configPath)));
    if (startupAbort.signal.aborted) throw new Error('Startup cancelled.');
    runtime = await connectRuntimes(config, log, startupAbort.signal);
    if (startupAbort.signal.aborted) throw new Error('Startup cancelled.');
    server = await startServer({ port: config.port, assets: fileURLToPath(new URL('./ui/', import.meta.url)), runtimes: runtime, log });
    startupComplete = true;
    if (startupAbort.signal.aborted) { await close(); }
    else {
      console.log(`Graph Playground ready: ${server.url}`);
      console.log('Open this full address. The part after # is a private key for this launch; do not share it.');
      const waiting = runtime.describe().filter(item => !item.ready);
      // Sources still preparing come online by themselves, even when none is ready yet.
      if (waiting.length) console.log(`Not ready yet: ${waiting.map(item => `${item.domain} (${item.status === 'preparing'
        ? 'still preparing' : 'unavailable'})`).join(', ')}. ${waiting.every(item => item.status === 'preparing')
        ? 'They come online by themselves within minutes. ' : ''}Wait, or run: ${setup(waiting.length === 1 ? waiting[0].domain : '<domain>')}`);
      terminal = createInterface({ input: process.stdin });
      terminal.on('line', line => { if (line.trim() === 'quit') void close(); });
    }
  } catch (cause) {
    if (startupAbort.signal.aborted) console.error('Apps host startup cancelled; owned MCP server cleanup requested.');
    else {
      console.error(`Apps host startup failed [${cause.code ?? 'STARTUP_ERROR'}]: ${cause instanceof Error && cause.name === 'ConnectorError' ? cause.message : 'Check the operator JSON, Python prerequisites, runtime bootstrap setup and complete installed plugin payload.'}`);
      process.exitCode = 1;
    }
    await close();
  }
}
