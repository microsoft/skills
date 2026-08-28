import { spawnSync } from 'node:child_process'

const npmArguments = process.argv.slice(2)
const isWindows = process.platform === 'win32'
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm'
const argumentsList = isWindows
  ? ['/d', '/s', '/c', 'npm', ...npmArguments]
  : npmArguments
const result = spawnSync(command, argumentsList, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
})

if (result.error) {
  console.error(`Unable to run npm: ${result.error.message}`)
  process.exitCode = 1
} else if (result.signal) {
  console.error(`npm terminated by signal ${result.signal}.`)
  process.exitCode = 1
} else {
  process.exitCode = result.status ?? 1
}
