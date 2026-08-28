import { parseAppointments, type Appointment } from './appointments.js'

const appointmentsEndpoint = '/api/appointments'

async function responseError(response: Response): Promise<Error> {
  let message = `The calendar service returned ${response.status}.`

  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string') message = body.error
  } catch {
    // The status code remains useful when an upstream returns a non-JSON error.
  }

  return new Error(message)
}

export async function loadAppointments(signal?: AbortSignal): Promise<Appointment[]> {
  const response = await fetch(appointmentsEndpoint, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) throw await responseError(response)
  return parseAppointments(await response.json())
}

export async function saveAppointments(appointments: Appointment[]): Promise<void> {
  const response = await fetch(appointmentsEndpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appointments),
  })

  if (!response.ok) throw await responseError(response)
}
