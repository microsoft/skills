# Daymark Calendar

A standalone React and TypeScript calendar fixture for managing simple appointments. The browser uses a same-origin TypeScript API backed by Azure Blob Storage in production, so storage credentials remain on the server.

## Run locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. Without Azure configuration, the API creates `data/appointments.json` on first use for local development. Use `npm run build`, `npm run lint`, and `npm test` for validation.

For a production-style local run:

```powershell
npm run build
npm start
```

Set `AZURE_STORAGE_CONNECTION_STRING` to persist appointments in Azure Blob Storage. Optionally set `CALENDAR_BLOB_CONTAINER` (default: `daymark`) and `CALENDAR_BLOB_NAME` (default: `appointments.json`). Create the configured container before starting the app. Azure credentials must only be configured on the server and must not be exposed as Vite client variables. `CALENDAR_DATA_FILE` retains the local development file override, and `PORT` changes the server port.

## Persistence architecture

The React client reads and writes `/api/appointments`. The API depends on the `AppointmentStore` interface in `server/appointmentStore.ts`. When `AZURE_STORAGE_CONNECTION_STRING` is configured, `AzureBlobAppointmentStore` is used to read and overwrite a single JSON blob. The local `JsonFileAppointmentStore` remains available for development without Azure. This boundary keeps storage credentials and privileged persistence operations out of the untrusted browser while making storage implementations independently testable.

## Features

- Six-week monthly calendar with month navigation
- Create, edit, and delete appointments
- Daily agenda with times, category, location, and notes
- Appointment search
- Responsive keyboard-accessible interface
- Same-origin API persistence with starter appointments

## Observability

The server exports logs and distributed traces to **Azure Monitor Application Insights** with the Azure Monitor OpenTelemetry distribution. Set `APPLICATIONINSIGHTS_CONNECTION_STRING` only in the server runtime environment; it is never exposed to the browser or Vite variables. The startup scripts preload telemetry so HTTP and Azure SDK calls (including Blob Storage) are automatically correlated. Daymark also records server-side calendar and Blob read/write operations with only safe operational metadata (HTTP method/status, storage type, and error type), not appointment content or credentials. When the connection string is absent, telemetry remains disabled for local development.
