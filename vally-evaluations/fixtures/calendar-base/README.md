# Daymark Calendar

A standalone React and TypeScript calendar fixture for managing simple appointments. The browser uses a same-origin TypeScript API backed by a replaceable local JSON appointment store; no external services or repository-level packages are required.

## Run locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. The API creates `data/appointments.json` on first use. Use `npm run build`, `npm run lint`, and `npm test` for validation.

For a production-style local run:

```powershell
npm run build
npm start
```

Set `CALENDAR_DATA_FILE` to override the JSON data path and `PORT` to change the server port.

## Persistence architecture

The React client reads and writes `/api/appointments`. The API depends on the
`AppointmentStore` interface in `server/appointmentStore.ts`; the included
`JsonFileAppointmentStore` is the default local implementation. This boundary
keeps storage credentials and privileged persistence operations out of the
untrusted browser while making alternate storage implementations independently
testable.

## Features

- Six-week monthly calendar with month navigation
- Create, edit, and delete appointments
- Daily agenda with times, category, location, and notes
- Appointment search
- Responsive keyboard-accessible interface
- Same-origin API persistence with starter appointments
