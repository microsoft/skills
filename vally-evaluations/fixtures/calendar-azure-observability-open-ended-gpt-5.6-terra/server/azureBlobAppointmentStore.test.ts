import { describe, expect, it } from 'vitest'
import type { Appointment } from '../src/appointments.js'
import { AzureBlobAppointmentStore, type AppointmentBlob } from './azureBlobAppointmentStore.js'

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

class MemoryBlob implements AppointmentBlob {
  data: Buffer | undefined
  uploadOptions: { blobHTTPHeaders: { blobContentType: string } } | undefined

  async downloadToBuffer(): Promise<Buffer> {
    if (!this.data) {
      const error = new Error('The specified blob does not exist.') as Error & {
        statusCode: number
        code: string
      }
      error.statusCode = 404
      error.code = 'BlobNotFound'
      throw error
    }
    return this.data
  }

  async uploadData(
    data: Buffer,
    options: { blobHTTPHeaders: { blobContentType: string } },
  ): Promise<void> {
    this.data = data
    this.uploadOptions = options
  }
}

describe('AzureBlobAppointmentStore', () => {
  it('initializes a missing blob with starter appointments', async () => {
    const blob = new MemoryBlob()
    const store = new AzureBlobAppointmentStore(blob)

    const appointments = await store.read()

    expect(appointments.length).toBeGreaterThan(0)
    expect(JSON.parse(blob.data!.toString('utf8'))).toEqual(appointments)
    expect(blob.uploadOptions).toEqual({
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    })
  })

  it('writes and reads validated appointment data from a blob', async () => {
    const blob = new MemoryBlob()
    const store = new AzureBlobAppointmentStore(blob)

    await store.write([appointment])

    expect(await store.read()).toEqual([appointment])
  })

  it('rejects malformed data read from a blob', async () => {
    const blob = new MemoryBlob()
    blob.data = Buffer.from('{"not":"appointments"}', 'utf8')

    await expect(new AzureBlobAppointmentStore(blob).read()).rejects.toThrow('valid appointment array')
  })
})