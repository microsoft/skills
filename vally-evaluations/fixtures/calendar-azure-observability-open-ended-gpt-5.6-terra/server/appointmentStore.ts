import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildStarterAppointments,
  parseAppointments,
  type Appointment,
} from '../src/appointments.js'

export interface AppointmentStore {
  read(): Promise<Appointment[]>
  write(appointments: Appointment[]): Promise<void>
}

export class JsonFileAppointmentStore implements AppointmentStore {
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async read(): Promise<Appointment[]> {
    try {
      return parseAppointments(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch (error) {
      if (!isMissingFile(error)) throw error

      const appointments = buildStarterAppointments(new Date())
      await this.write(appointments)
      return appointments
    }
  }

  async write(appointments: Appointment[]): Promise<void> {
    const validatedAppointments = parseAppointments(appointments)
    await mkdir(path.dirname(this.filePath), { recursive: true })

    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(validatedAppointments, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.filePath)
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
