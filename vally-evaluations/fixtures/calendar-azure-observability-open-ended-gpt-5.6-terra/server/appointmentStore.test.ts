import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Appointment } from '../src/appointments.js'
import { JsonFileAppointmentStore } from './appointmentStore.js'

const temporaryDirectories: string[] = []

async function createStore(): Promise<{ filePath: string; store: JsonFileAppointmentStore }> {
  const directory = await mkdtemp(path.join(tmpdir(), 'daymark-store-'))
  temporaryDirectories.push(directory)
  const filePath = path.join(directory, 'appointments.json')
  return { filePath, store: new JsonFileAppointmentStore(filePath) }
}

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

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })))
})

describe('JsonFileAppointmentStore', () => {
  it('initializes a missing data file with starter appointments', async () => {
    const { filePath, store } = await createStore()

    const appointments = await store.read()

    expect(appointments.length).toBeGreaterThan(0)
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(appointments)
  })

  it('writes and reads an appointment collection', async () => {
    const { store } = await createStore()

    await store.write([appointment])

    expect(await store.read()).toEqual([appointment])
  })

  it('rejects malformed stored data', async () => {
    const { filePath, store } = await createStore()
    await writeFile(filePath, '{"not":"appointments"}', 'utf8')

    await expect(store.read()).rejects.toThrow('valid appointment array')
  })
})
