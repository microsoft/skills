import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { createCalendarApiHandler } from './calendarApi.js'
import { JsonFileAppointmentStore } from './appointmentStore.js'

const projectRoot = process.cwd()
const dataFile = process.env.CALENDAR_DATA_FILE
  ? path.resolve(process.env.CALENDAR_DATA_FILE)
  : path.join(projectRoot, 'data', 'appointments.json')
const distDirectory = path.join(projectRoot, 'dist')
const apiOnly = process.argv.includes('--api-only')
const port = Number(process.env.PORT ?? 3001)
const handleApi = createCalendarApiHandler(new JsonFileAppointmentStore(dataFile))

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

async function handleStatic(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (apiOnly) {
    response.writeHead(404)
    response.end()
    return
  }

  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1)
  let filePath = path.resolve(distDirectory, requestedPath)

  if (!filePath.startsWith(`${distDirectory}${path.sep}`)) {
    response.writeHead(400)
    response.end('Invalid path.')
    return
  }

  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file')
  } catch {
    filePath = path.join(distDirectory, 'index.html')
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
  })
  createReadStream(filePath).pipe(response)
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const operation = pathname.startsWith('/api/') ? handleApi(request, response) : handleStatic(request, response)
  void operation.catch((error: unknown) => {
    console.error('Calendar server request failed.', error)
    if (!response.headersSent) response.writeHead(500)
    response.end('Internal server error.')
  })
})

server.listen(port, () => {
  console.log(`Daymark server listening on http://localhost:${port}`)
})
