import { SpanStatusCode, trace, type Attributes, type Tracer } from '@opentelemetry/api'
import { logs, SeverityNumber, type Logger } from '@opentelemetry/api-logs'
import type { AzureMonitorOpenTelemetryOptions } from '@azure/monitor-opentelemetry'

type TelemetryAttributes = Record<string, string | number | boolean>

export interface Telemetry {
  runOperation<T>(name: string, attributes: TelemetryAttributes, operation: () => Promise<T>): Promise<T>
  logWarning(message: string, attributes: TelemetryAttributes): void
}

class OpenTelemetry implements Telemetry {
  private readonly tracer: Tracer
  private readonly logger: Logger

  constructor(
    tracer: Tracer,
    logger: Logger,
  ) {
    this.tracer = tracer
    this.logger = logger
  }

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

let telemetry: Telemetry | undefined
let azureMonitorStarted = false

export function getTelemetry(): Telemetry {
  telemetry ??= new OpenTelemetry(trace.getTracer('daymark'), logs.getLogger('daymark'))
  return telemetry
}

export function initializeAzureMonitor(
  connectionString: string | undefined,
  configure: (options: AzureMonitorOpenTelemetryOptions) => void,
): boolean {
  if (!connectionString || azureMonitorStarted) return false
  configure({
    azureMonitorExporterOptions: { connectionString },
    instrumentationOptions: { azureSdk: { enabled: true }, http: { enabled: true }, console: { enabled: false } },
  })
  azureMonitorStarted = true
  telemetry = new OpenTelemetry(trace.getTracer('daymark'), logs.getLogger('daymark'))
  return true
}

export async function shutdownTelemetry(): Promise<void> {
  if (!azureMonitorStarted) return
  const { shutdownAzureMonitor } = await import('@azure/monitor-opentelemetry')
  await shutdownAzureMonitor()
  azureMonitorStarted = false
  telemetry = undefined
}
