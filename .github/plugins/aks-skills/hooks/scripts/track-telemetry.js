const { spawnSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

function getHookCommand(platform) {
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(__dirname, "track-telemetry.ps1"),
      ],
    };
  }

  return {
    command: "bash",
    args: [path.join(__dirname, "track-telemetry.sh")],
  };
}

function run(platform = os.platform(), spawn = spawnSync) {
  const { command, args } = getHookCommand(platform);
  const result = spawn(command, args, { stdio: "inherit" });

  if (result.error) {
    console.error(`Failed to run telemetry hook: ${result.error.message}`);
    return 1;
  }

  return result.status ?? 1;
}

module.exports = { getHookCommand, run };

if (require.main === module) {
  process.exitCode = run();
}
