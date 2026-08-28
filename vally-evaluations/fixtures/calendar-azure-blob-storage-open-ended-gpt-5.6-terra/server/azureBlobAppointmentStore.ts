import { BlobServiceClient } from '@azure/storage-blob'
import {
  buildStarterAppointments,
  parseAppointments,
  type Appointment,
} from '../src/appointments.js'
import type { AppointmentStore } from './appointmentStore.js'

export interface AppointmentBlob {
  downloadToBuffer(): Promise<Buffer>
  uploadData(data: Buffer, options: { blobHTTPHeaders: { blobContentType: string } }): Promise<unknown>
}

export class AzureBlobAppointmentStore implements AppointmentStore {
  private readonly blob: AppointmentBlob

  constructor(blob: AppointmentBlob) {
    this.blob = blob
  }

  static fromConnectionString(
    connectionString: string,
    containerName: string,
    blobName: string,
  ): AzureBlobAppointmentStore {
    const blob = BlobServiceClient
      .fromConnectionString(connectionString)
      .getContainerClient(containerName)
      .getBlockBlobClient(blobName)
    return new AzureBlobAppointmentStore(blob)
  }

  async read(): Promise<Appointment[]> {
    try {
      return parseAppointments(JSON.parse((await this.blob.downloadToBuffer()).toString('utf8')))
    } catch (error) {
      if (!isMissingBlob(error)) throw error

      const appointments = buildStarterAppointments(new Date())
      await this.write(appointments)
      return appointments
    }
  }

  async write(appointments: Appointment[]): Promise<void> {
    const validatedAppointments = parseAppointments(appointments)
    await this.blob.uploadData(
      Buffer.from(`${JSON.stringify(validatedAppointments, null, 2)}\n`, 'utf8'),
      { blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' } },
    )
  }
}

function isMissingBlob(error: unknown): boolean {
  return error instanceof Error
    && 'statusCode' in error
    && error.statusCode === 404
    && ('code' in error ? error.code === 'BlobNotFound' : true)
}
