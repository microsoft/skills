import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { useAzureMonitor } from '@azure/monitor-opentelemetry'

type TelemetryAttributes = Record<string, string | number | boolean>

export interface Telemetry {
  runOperation<T>(name: string, attributes: TelemetryAttributes, operation: () => Promise<T>): Promise<T>
  logWarning(message: string, attributes: TelemetryAttributes): void
}

class OpenTelemetry implements Telemetry {
  private readonly tracer = trace.getTracer('daymark')
  private readonly logger = logs.getLogger('daymark')

  async runOperation<T>(name: string, attributes: TelemetryAttributes, operation: () => Promise<T>): Promise<T> {
    return this.tracer.startActiveSpan(name, async (span) => {
      span.setAttributes(attributes as Attributes)
      this.logger.emit({ body: `${name} started`, severityNumber: SeverityNumber.INFO, attributes })
      try {
        const result = await operation()
        span.setStatus({ code: SpanStatusCode.OK })
        this.logger.emit({ body: `${name} completed`, severityNumber: SeverityNumber.INFO, attributes })
        return result
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error))
        span.setStatus({ code: SpanStatusCode.ERROR })
        this.logger.emit({ body: `${name} failed`, severityNumber: SeverityNumber.ERROR, attributes: { ...attributes, 'error.type': error instanceof Error ? error.name : 'UnknownError' } })
        throw error
      } finally {
        span.end()
      }
    })
  }

  logWarning(message: string, attributes: TelemetryAttributes): void {
    this.logger.emit({ body: message, severityNumber: SeverityNumber.WARN, attributes })
  }
}

const telemetry = new OpenTelemetry()
let azureMonitorStarted = false

export function getTelemetry(): Telemetry {
  return telemetry
}

export function initializeAzureMonitor(connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING, configure = useAzureMonitor): boolean {
  if (!connectionString || azureMonitorStarted) return false
  configure({
    azureMonitorExporterOptions: { connectionString },
    instrumentationOptions: { azureSdk: { enabled: true }, http: { enabled: true }, console: { enabled: false } },
  })
  azureMonitorStarted = true
  return true
}
