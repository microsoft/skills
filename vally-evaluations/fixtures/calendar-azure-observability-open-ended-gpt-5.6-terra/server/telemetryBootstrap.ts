import { useAzureMonitor } from '@azure/monitor-opentelemetry'
import { initializeAzureMonitor } from './telemetry.js'

initializeAzureMonitor(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING, useAzureMonitor)
await import('./index.js')
