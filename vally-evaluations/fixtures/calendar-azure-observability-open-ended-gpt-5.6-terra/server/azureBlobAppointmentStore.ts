import { BlobServiceClient } from '@azure/storage-blob'
import { buildStarterAppointments, parseAppointments, type Appointment } from '../src/appointments.js'
import type { AppointmentStore } from './appointmentStore.js'
import { getTelemetry, type Telemetry } from './telemetry.js'

export interface AppointmentBlob {
  downloadToBuffer(): Promise<Buffer>
  uploadData(data: Buffer, options: { blobHTTPHeaders: { blobContentType: string } }): Promise<unknown>
}

export class AzureBlobAppointmentStore implements AppointmentStore {
  private readonly blob: AppointmentBlob
  private readonly telemetry: Telemetry

  constructor(blob: AppointmentBlob, telemetry: Telemetry = getTelemetry()) {
    this.blob = blob
    this.telemetry = telemetry
  }

  static fromConnectionString(connectionString: string, containerName: string, blobName: string): AzureBlobAppointmentStore {
    const blob = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName).getBlockBlobClient(blobName)
    return new AzureBlobAppointmentStore(blob)
  }

  async read(): Promise<Appointment[]> {
    return this.telemetry.runOperation('daymark.storage.blob.read', { 'db.system.name': 'azureblob' }, async () => {
      try {
        return parseAppointments(JSON.parse((await this.blob.downloadToBuffer()).toString('utf8')))
      } catch (error) {
        if (!isMissingBlob(error)) throw error
        const appointments = buildStarterAppointments(new Date())
        await this.write(appointments)
        return appointments
      }
    })
  }

  async write(appointments: Appointment[]): Promise<void> {
    await this.telemetry.runOperation('daymark.storage.blob.write', { 'db.system.name': 'azureblob' }, async () => {
      const validatedAppointments = parseAppointments(appointments)
      await this.blob.uploadData(Buffer.from(`${JSON.stringify(validatedAppointments, null, 2)}\n`, 'utf8'), {
        blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
      })
    })
  }
}

function isMissingBlob(error: unknown): boolean {
  return error instanceof Error && 'statusCode' in error && error.statusCode === 404 && ('code' in error ? error.code === 'BlobNotFound' : true)
}
