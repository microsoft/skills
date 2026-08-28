import { addDays, toDateKey } from './calendar.js'

export type Category = 'focus' | 'meeting' | 'personal'

export type Appointment = {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  category: Category
  location: string
  notes: string
}

export function buildStarterAppointments(today: Date): Appointment[] {
  return [
    {
      id: 'starter-design-review',
      title: 'Design review',
      date: toDateKey(today),
      startTime: '10:00',
      endTime: '10:45',
      category: 'meeting',
      location: 'Studio room',
      notes: 'Review the latest calendar interactions.',
    },
    {
      id: 'starter-focus-block',
      title: 'Project focus',
      date: toDateKey(today),
      startTime: '14:00',
      endTime: '16:00',
      category: 'focus',
      location: '',
      notes: 'Protected time for deep work.',
    },
    {
      id: 'starter-coffee',
      title: 'Coffee with Maya',
      date: toDateKey(addDays(today, 2)),
      startTime: '09:30',
      endTime: '10:15',
      category: 'personal',
      location: 'North Star Cafe',
      notes: '',
    },
    {
      id: 'starter-planning',
      title: 'Weekly planning',
      date: toDateKey(addDays(today, 5)),
      startTime: '11:00',
      endTime: '11:45',
      category: 'focus',
      location: '',
      notes: 'Set priorities for the week ahead.',
    },
  ]
}

export function isAppointment(value: unknown): value is Appointment {
  if (!value || typeof value !== 'object') return false

  const appointment = value as Record<string, unknown>
  return (
    typeof appointment.id === 'string'
    && typeof appointment.title === 'string'
    && typeof appointment.date === 'string'
    && typeof appointment.startTime === 'string'
    && typeof appointment.endTime === 'string'
    && (
      appointment.category === 'focus'
      || appointment.category === 'meeting'
      || appointment.category === 'personal'
    )
    && typeof appointment.location === 'string'
    && typeof appointment.notes === 'string'
  )
}

export function parseAppointments(value: unknown): Appointment[] {
  if (!Array.isArray(value) || !value.every(isAppointment)) {
    throw new TypeError('Appointment data must be a valid appointment array.')
  }

  return value
}
