import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import type { Appointment } from '../src/appointments.js'
import type { AppointmentStore } from './appointmentStore.js'
import { AzureBlobAppointmentStore, type AppointmentBlob } from './azureBlobAppointmentStore.js'
import { createCalendarApiHandler } from './calendarApi.js'
import type { Telemetry } from './telemetry.js'

const servers: ReturnType<typeof createServer>[] = []
const appointment: Appointment = { id: 'planning', title: 'Planning', date: '2026-08-28', startTime: '09:00', endTime: '09:30', category: 'focus', location: '', notes: '' }

class RecordingTelemetry implements Telemetry {
  readonly operations: string[] = []
  readonly warnings: Array<{ message: string; statusCode: number }> = []

  async runOperation<T>(name: string, _attributes: Record<string, string | number | boolean>, operation: () => Promise<T>): Promise<T> {
    this.operations.push(name)
    return operation()
  }

  logWarning(message: string, attributes: Record<string, string | number | boolean>): void {
    this.warnings.push({ message, statusCode: Number(attributes['http.response.status_code']) })
  }
}

class MemoryStore implements AppointmentStore {
  async read(): Promise<Appointment[]> { return [appointment] }
  async write(): Promise<void> {}
}

class MemoryBlob implements AppointmentBlob {
  data = Buffer.from(JSON.stringify([appointment]))
  async downloadToBuffer(): Promise<Buffer> { return this.data }
  async uploadData(data: Buffer): Promise<void> { this.data = data }
}

async function startApi(telemetry: Telemetry): Promise<string> {
  const handler = createCalendarApiHandler(new MemoryStore(), telemetry)
  const server = createServer((request, response) => void handler(request, response))
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('API server did not expose a TCP port.')
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))))
})

describe('observability instrumentation', () => {
  it('records calendar requests and rejected payloads without recording appointment data', async () => {
    const telemetry = new RecordingTelemetry()
    const baseUrl = await startApi(telemetry)

    await fetch(`${baseUrl}/api/appointments`)
    await fetch(`${baseUrl}/api/appointments`, { method: 'PUT', body: '{' })

    expect(telemetry.operations).toEqual(['daymark.calendar.request', 'daymark.calendar.request'])
    expect(telemetry.warnings).toEqual([{ message: 'Calendar request rejected', statusCode: 400 }])
  })

  it('records Blob read and write operations', async () => {
    const telemetry = new RecordingTelemetry()
    const store = new AzureBlobAppointmentStore(new MemoryBlob(), telemetry)

    await store.read()
    await store.write([appointment])

    expect(telemetry.operations).toEqual(['daymark.storage.blob.read', 'daymark.storage.blob.write'])
  })
})
