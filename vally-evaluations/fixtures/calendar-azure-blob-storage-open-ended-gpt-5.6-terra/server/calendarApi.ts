import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseAppointments } from '../src/appointments.js'
import type { AppointmentStore } from './appointmentStore.js'

const maximumRequestBytes = 1_048_576

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(value))
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maximumRequestBytes) {
      throw new RequestError(413, 'The appointment payload is too large.')
    }
    chunks.push(buffer)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RequestError(400, 'The request body must contain valid JSON.')
  }
}

export function createCalendarApiHandler(store: AppointmentStore) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (pathname !== '/api/appointments') {
      sendJson(response, 404, { error: 'Not found.' })
      return
    }

    try {
      if (request.method === 'GET') {
        sendJson(response, 200, await store.read())
        return
      }

      if (request.method === 'PUT') {
        const appointments = parseAppointments(await readJsonBody(request))
        await store.write(appointments)
        response.writeHead(204, { 'Cache-Control': 'no-store' })
        response.end()
        return
      }

      response.setHeader('Allow', 'GET, PUT')
      sendJson(response, 405, { error: 'Method not allowed.' })
    } catch (error) {
      if (error instanceof RequestError) {
        sendJson(response, error.statusCode, { error: error.message })
        return
      }
      if (error instanceof TypeError) {
        sendJson(response, 400, { error: error.message })
        return
      }

      console.error('Calendar API request failed.', error)
      sendJson(response, 500, { error: 'The calendar data could not be accessed.' })
    }
  }
}

class RequestError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}
