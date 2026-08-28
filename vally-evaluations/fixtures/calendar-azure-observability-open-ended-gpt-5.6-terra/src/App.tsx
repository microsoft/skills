import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadAppointments, saveAppointments } from './appointmentApi'
import type { Appointment, Category } from './appointments'
import {
  formatDayHeading,
  formatMonthHeading,
  getMonthGrid,
  isSameDay,
  startOfMonth,
  toDateKey,
} from './calendar'
import './App.css'

type AppointmentDraft = Omit<Appointment, 'id'>

type EditorState =
  | { mode: 'create'; date: string }
  | { mode: 'edit'; appointment: Appointment }
  | null

const categoryLabels: Record<Category, string> = {
  focus: 'Focus',
  meeting: 'Meeting',
  personal: 'Personal',
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function formatTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2020, 0, 1, hours, minutes))
}

function Icon({
  name,
  size = 18,
}: {
  name: 'calendar' | 'chevron-left' | 'chevron-right' | 'clock' | 'close' | 'location' | 'plus' | 'search'
  size?: number
}) {
  const paths = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    'chevron-left': <path d="m15 18-6-6 6-6" />,
    'chevron-right': <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    close: <path d="M18 6 6 18M6 6l12 12" />,
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  )
}

function AppointmentEditor({
  editor,
  onClose,
  onDelete,
  onSave,
}: {
  editor: Exclude<EditorState, null>
  onClose: () => void
  onDelete: (id: string) => Promise<void>
  onSave: (draft: AppointmentDraft, id?: string) => Promise<void>
}) {
  const appointment = editor.mode === 'edit' ? editor.appointment : null
  const [draft, setDraft] = useState<AppointmentDraft>({
    title: appointment?.title ?? '',
    date: editor.mode === 'edit' ? editor.appointment.date : editor.date,
    startTime: appointment?.startTime ?? '09:00',
    endTime: appointment?.endTime ?? '09:30',
    category: appointment?.category ?? 'meeting',
    location: appointment?.location ?? '',
    notes: appointment?.notes ?? '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const updateDraft = <Key extends keyof AppointmentDraft>(
    key: Key,
    value: AppointmentDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.title.trim()) {
      setError('Add a title so the appointment is easy to recognize.')
      return
    }
    if (minutesFromTime(draft.endTime) <= minutesFromTime(draft.startTime)) {
      setError('End time must be later than start time.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      await onSave({ ...draft, title: draft.title.trim() }, appointment?.id)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The appointment could not be saved.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="editor-title"
        aria-modal="true"
        className="appointment-editor"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="editor-heading">
          <div>
            <p className="eyebrow">{editor.mode === 'edit' ? 'Appointment details' : 'New appointment'}</p>
            <h2 id="editor-title">{editor.mode === 'edit' ? 'Edit your plans' : 'Make time for it'}</h2>
          </div>
          <button aria-label="Close appointment editor" className="icon-button" onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field field-wide">
            <span>Title</span>
            <input
              autoFocus
              maxLength={80}
              onChange={(event) => updateDraft('title', event.target.value)}
              placeholder="What are you planning?"
              value={draft.title}
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span>Date</span>
              <input onChange={(event) => updateDraft('date', event.target.value)} required type="date" value={draft.date} />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                onChange={(event) => updateDraft('category', event.target.value as Category)}
                value={draft.category}
              >
                <option value="meeting">Meeting</option>
                <option value="focus">Focus</option>
                <option value="personal">Personal</option>
              </select>
            </label>
            <label className="field">
              <span>Starts</span>
              <input
                onChange={(event) => updateDraft('startTime', event.target.value)}
                required
                type="time"
                value={draft.startTime}
              />
            </label>
            <label className="field">
              <span>Ends</span>
              <input
                onChange={(event) => updateDraft('endTime', event.target.value)}
                required
                type="time"
                value={draft.endTime}
              />
            </label>
          </div>

          <label className="field field-wide">
            <span>Location <small>Optional</small></span>
            <input
              maxLength={100}
              onChange={(event) => updateDraft('location', event.target.value)}
              placeholder="Add a place or call link"
              value={draft.location}
            />
          </label>

          <label className="field field-wide">
            <span>Notes <small>Optional</small></span>
            <textarea
              maxLength={500}
              onChange={(event) => updateDraft('notes', event.target.value)}
              placeholder="Anything you want to remember"
              rows={3}
              value={draft.notes}
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="editor-actions">
            {appointment && (
              <button
                className="button danger-button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsSubmitting(true)
                  setError('')
                  void onDelete(appointment.id).catch((deleteError: unknown) => {
                    setError(deleteError instanceof Error ? deleteError.message : 'The appointment could not be deleted.')
                    setIsSubmitting(false)
                  })
                }}
                type="button"
              >
                Delete
              </button>
            )}
            <div className="editor-actions-right">
              <button className="button secondary-button" onClick={onClose} type="button">Cancel</button>
              <button className="button primary-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : appointment ? 'Save changes' : 'Add appointment'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

function App() {
  const today = useMemo(() => new Date(), [])
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(today))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [storageStatus, setStorageStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [storageMessage, setStorageMessage] = useState('Loading appointments...')
  const [editor, setEditor] = useState<EditorState>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const calendarDays = useMemo(() => getMonthGrid(currentMonth), [currentMonth])

  const loadCalendar = useCallback(async (signal?: AbortSignal) => {
    setStorageStatus('loading')
    setStorageMessage('Loading appointments...')
    try {
      setAppointments(await loadAppointments(signal))
      setStorageStatus('ready')
      setStorageMessage('Appointments are up to date.')
    } catch (error) {
      if (signal?.aborted) return
      setStorageStatus('error')
      setStorageMessage(error instanceof Error ? error.message : 'Appointments could not be loaded.')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadAppointments(controller.signal)
      .then((loadedAppointments) => {
        setAppointments(loadedAppointments)
        setStorageStatus('ready')
        setStorageMessage('Appointments are up to date.')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setStorageStatus('error')
        setStorageMessage(error instanceof Error ? error.message : 'Appointments could not be loaded.')
      })
    return () => controller.abort()
  }, [])

  const visibleAppointments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return appointments
    return appointments.filter((appointment) =>
      [appointment.title, appointment.location, appointment.notes, categoryLabels[appointment.category]]
        .some((value) => value.toLowerCase().includes(query)),
    )
  }, [appointments, searchQuery])

  const appointmentsByDate = useMemo(() => {
    return visibleAppointments.reduce<Record<string, Appointment[]>>((grouped, appointment) => {
      grouped[appointment.date] = [...(grouped[appointment.date] ?? []), appointment]
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
      return grouped
    }, {})
  }, [visibleAppointments])

  const selectedAppointments = appointmentsByDate[selectedDate] ?? []

  const moveMonth = (offset: number) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1)
    setCurrentMonth(nextMonth)
    setSelectedDate(toDateKey(nextMonth))
  }

  const goToToday = () => {
    setCurrentMonth(startOfMonth(today))
    setSelectedDate(toDateKey(today))
  }

  const persistAppointments = async (nextAppointments: Appointment[], successMessage: string) => {
    setStorageStatus('saving')
    setStorageMessage('Saving appointments...')
    try {
      await saveAppointments(nextAppointments)
      setAppointments(nextAppointments)
      setStorageStatus('ready')
      setStorageMessage('Appointments are up to date.')
      setAnnouncement(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Appointments could not be saved.'
      setStorageStatus('error')
      setStorageMessage(message)
      throw new Error(message)
    }
  }

  const saveAppointment = async (draft: AppointmentDraft, id?: string) => {
    const nextAppointments = id
      ? appointments.map((item) => (item.id === id ? { ...draft, id } : item))
      : [...appointments, { ...draft, id: crypto.randomUUID() }]
    await persistAppointments(nextAppointments, `${draft.title} ${id ? 'updated' : 'added'}.`)
    setSelectedDate(draft.date)
    const [year, month] = draft.date.split('-').map(Number)
    setCurrentMonth(new Date(year, month - 1, 1))
    setEditor(null)
  }

  const deleteAppointment = async (id: string) => {
    const deleted = appointments.find((appointment) => appointment.id === id)
    await persistAppointments(
      appointments.filter((appointment) => appointment.id !== id),
      `${deleted?.title ?? 'Appointment'} deleted.`,
    )
    setEditor(null)
  }

  const isStorageBusy = storageStatus === 'loading' || storageStatus === 'saving'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#calendar" aria-label="Daymark calendar home">
          <span className="brand-mark"><span /></span>
          <span>Daymark</span>
        </a>
        <div className="header-date">
          <span>{new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today)}</span>
          <strong>{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(today)}</strong>
        </div>
        <div className="header-actions">
          <label className="search-field">
            <span className="sr-only">Search appointments</span>
            <Icon name="search" />
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search appointments"
              type="search"
              value={searchQuery}
            />
          </label>
          <button
            className="button primary-button add-button"
            disabled={isStorageBusy}
            onClick={() => setEditor({ mode: 'create', date: selectedDate })}
            type="button"
          >
            <Icon name="plus" />
            <span>New appointment</span>
          </button>
        </div>
      </header>

      <div
        aria-live="polite"
        className={`storage-status ${storageStatus === 'error' ? 'storage-error' : ''}`}
        role={storageStatus === 'error' ? 'alert' : 'status'}
      >
        <span>{storageMessage}</span>
        {storageStatus === 'error' && (
          <button className="text-button" onClick={() => void loadCalendar()} type="button">
            Retry
          </button>
        )}
      </div>

      <main aria-busy={isStorageBusy}>
        <section className="calendar-panel" id="calendar">
          <div className="calendar-toolbar">
            <div>
              <p className="eyebrow">Your schedule</p>
              <h1>{formatMonthHeading(currentMonth)}</h1>
            </div>
            <div className="month-controls" aria-label="Calendar navigation">
              <button className="today-button" onClick={goToToday} type="button">Today</button>
              <button aria-label="Previous month" className="icon-button" onClick={() => moveMonth(-1)} type="button">
                <Icon name="chevron-left" />
              </button>
              <button aria-label="Next month" className="icon-button" onClick={() => moveMonth(1)} type="button">
                <Icon name="chevron-right" />
              </button>
            </div>
          </div>

          <div className="calendar-grid calendar-weekdays" role="row">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} role="columnheader">{day}</div>
            ))}
          </div>

          <div className="calendar-grid month-grid" role="grid" aria-label={formatMonthHeading(currentMonth)}>
            {calendarDays.map((date) => {
              const dateKey = toDateKey(date)
              const dayAppointments = appointmentsByDate[dateKey] ?? []
              const outsideMonth = date.getMonth() !== currentMonth.getMonth()
              const selected = dateKey === selectedDate
              return (
                <div
                  aria-label={`${formatDayHeading(date)}, ${dayAppointments.length} appointments`}
                  aria-selected={selected}
                  className={`calendar-day${outsideMonth ? ' outside-month' : ''}${selected ? ' selected-day' : ''}`}
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedDate(dateKey)
                    }
                  }}
                  role="gridcell"
                  tabIndex={selected ? 0 : -1}
                >
                  <div className="day-number-row">
                    <span className={isSameDay(date, today) ? 'today-number' : ''}>{date.getDate()}</span>
                    <button
                      aria-label={`Add appointment on ${formatDayHeading(date)}`}
                      className="day-add-button"
                      disabled={isStorageBusy}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedDate(dateKey)
                        setEditor({ mode: 'create', date: dateKey })
                      }}
                      type="button"
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  <div className="day-events">
                    {dayAppointments.slice(0, 3).map((appointment) => (
                      <button
                        className="event-chip"
                        data-category={appointment.category}
                        key={appointment.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditor({ mode: 'edit', appointment })
                        }}
                        type="button"
                      >
                        <span className="event-dot" />
                        <span className="event-time">{formatTime(appointment.startTime)}</span>
                        <span className="event-title">{appointment.title}</span>
                      </button>
                    ))}
                    {dayAppointments.length > 3 && <span className="more-events">+{dayAppointments.length - 3} more</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="agenda-panel" aria-labelledby="agenda-heading">
          <div className="agenda-date">
            <span>{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${selectedDate}T12:00:00`))}</span>
            <strong>{Number(selectedDate.slice(-2))}</strong>
          </div>
          <div className="agenda-heading-row">
            <div>
              <p className="eyebrow">Daily agenda</p>
              <h2 id="agenda-heading">{formatDayHeading(new Date(`${selectedDate}T12:00:00`))}</h2>
            </div>
            <button
              aria-label={`Add appointment on ${formatDayHeading(new Date(`${selectedDate}T12:00:00`))}`}
              className="icon-button"
              disabled={isStorageBusy}
              onClick={() => setEditor({ mode: 'create', date: selectedDate })}
              type="button"
            >
              <Icon name="plus" />
            </button>
          </div>

          <div className="agenda-list">
            {selectedAppointments.length ? selectedAppointments.map((appointment) => (
              <button
                className="agenda-card"
                data-category={appointment.category}
                key={appointment.id}
                onClick={() => setEditor({ mode: 'edit', appointment })}
                type="button"
              >
                <span className="agenda-accent" />
                <span className="agenda-content">
                  <span className="agenda-meta">
                    <span><Icon name="clock" size={15} />{formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}</span>
                    <span className="category-pill">{categoryLabels[appointment.category]}</span>
                  </span>
                  <strong>{appointment.title}</strong>
                  {appointment.location && <span className="agenda-location"><Icon name="location" size={15} />{appointment.location}</span>}
                  {appointment.notes && <span className="agenda-notes">{appointment.notes}</span>}
                </span>
              </button>
            )) : (
              <div className="empty-agenda">
                <span className="empty-icon"><Icon name="calendar" size={25} /></span>
                <h3>{searchQuery ? 'No matches this day' : 'A clear day'}</h3>
                <p>{searchQuery ? 'Try a different search or date.' : 'There is room for something meaningful.'}</p>
                {!searchQuery && (
                  <button className="text-button" onClick={() => setEditor({ mode: 'create', date: selectedDate })} type="button">
                    Add an appointment <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="agenda-footer">
            <span><i className="legend-dot focus-dot" />Focus</span>
            <span><i className="legend-dot meeting-dot" />Meeting</span>
            <span><i className="legend-dot personal-dot" />Personal</span>
          </div>
        </aside>
      </main>

      <div aria-live="polite" className="sr-only">{announcement}</div>
      {editor && (
        <AppointmentEditor
          editor={editor}
          onClose={() => setEditor(null)}
          onDelete={deleteAppointment}
          onSave={saveAppointment}
        />
      )}
    </div>
  )
}

export default App
