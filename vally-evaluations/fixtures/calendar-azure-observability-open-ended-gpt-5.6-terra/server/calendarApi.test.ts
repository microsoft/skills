import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import type { Appointment } from '../src/appointments.js'
import type { AppointmentStore } from './appointmentStore.js'
import { createCalendarApiHandler } from './calendarApi.js'

const servers: ReturnType<typeof createServer>[] = []

const appointment: Appointment = {
  id: 'planning',
  title: 'Planning',
  date: '2026-08-28',
  startTime: '09:00',
  endTime: '09:30',
  category: 'focus',
  location: '',
  notes: '',
}

class MemoryAppointmentStore implements AppointmentStore {
  appointments = [appointment]

  async read(): Promise<Appointment[]> {
    return this.appointments
  }

  async write(appointments: Appointment[]): Promise<void> {
    this.appointments = appointments
  }
}

async function startApi(store: AppointmentStore): Promise<string> {
  const handleApi = createCalendarApiHandler(store)
  const server = createServer((request, response) => void handleApi(request, response))
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('API server did not expose a TCP port.')
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))))
})

describe('calendar API', () => {
  it('loads appointments from the configured store', async () => {
    const baseUrl = await startApi(new MemoryAppointmentStore())

    const response = await fetch(`${baseUrl}/api/appointments`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([appointment])
  })

  it('saves appointments through the configured store', async () => {
    const store = new MemoryAppointmentStore()
    const baseUrl = await startApi(store)

    const response = await fetch(`${baseUrl}/api/appointments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '[]',
    })

    expect(response.status).toBe(204)
    expect(store.appointments).toEqual([])
  })

  it('rejects malformed appointment data', async () => {
    const baseUrl = await startApi(new MemoryAppointmentStore())

    const response = await fetch(`${baseUrl}/api/appointments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"not":"appointments"}',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Appointment data must be a valid appointment array.',
    })
  })
})
