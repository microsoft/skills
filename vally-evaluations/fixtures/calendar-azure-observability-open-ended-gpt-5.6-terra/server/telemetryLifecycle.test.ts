import {
  SpanStatusCode,
  context,
  trace,
  type Attributes,
  type Context,
  type Exception,
  type Link,
  type Span,
  type SpanAttributeValue,
  type SpanContext,
  type SpanOptions,
  type SpanStatus,
  type TimeInput,
  type Tracer,
  type TracerOptions,
  type TracerProvider,
} from '@opentelemetry/api'
import {
  logs,
  type LogRecord,
  type Logger,
  type LoggerOptions,
  type LoggerProvider,
} from '@opentelemetry/api-logs'
import { afterEach, describe, expect, it } from 'vitest'
import { getTelemetry, initializeAzureMonitor } from './telemetry.js'

class RecordingSpan implements Span {
  constructor(
    private readonly name: string,
    private readonly events: string[],
  ) {}

  spanContext(): SpanContext {
    return {
      traceId: '00000000000000000000000000000001',
      spanId: '0000000000000001',
      traceFlags: 1,
    }
  }

  setAttribute(_key: string, _value: SpanAttributeValue): this { return this }
  setAttributes(_attributes: Attributes): this { return this }
  addEvent(_name: string, _attributesOrStartTime?: Attributes | TimeInput, _startTime?: TimeInput): this { return this }
  addLink(_link: Link): this { return this }
  addLinks(_links: Link[]): this { return this }
  setStatus(status: SpanStatus): this {
    this.events.push(`status:${status.code}`)
    return this
  }
  updateName(_name: string): this { return this }
  end(_endTime?: TimeInput): void { this.events.push(`span:${this.name}:end`) }
  isRecording(): boolean { return true }
  recordException(_exception: Exception, _time?: TimeInput): void {}
}

class RecordingTracer implements Tracer {
  constructor(private readonly events: string[]) {}

  startSpan(name: string, _options?: SpanOptions, _context?: Context): Span {
    this.events.push(`span:${name}:start`)
    return new RecordingSpan(name, this.events)
  }

  startActiveSpan<F extends (span: Span) => unknown>(name: string, fn: F): ReturnType<F>
  startActiveSpan<F extends (span: Span) => unknown>(name: string, options: SpanOptions, fn: F): ReturnType<F>
  startActiveSpan<F extends (span: Span) => unknown>(name: string, options: SpanOptions, context: Context, fn: F): ReturnType<F>
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    optionsOrCallback: SpanOptions | F,
    contextOrCallback?: Context | F,
    callback?: F,
  ): ReturnType<F> {
    const operation = typeof optionsOrCallback === 'function'
      ? optionsOrCallback
      : typeof contextOrCallback === 'function'
        ? contextOrCallback
        : callback
    if (!operation) throw new Error('A span callback is required.')
    return context.with(context.active(), operation, undefined, this.startSpan(name))
  }
}

class RecordingTracerProvider implements TracerProvider {
  constructor(private readonly events: string[]) {}

  getTracer(_name: string, _version?: string, _options?: TracerOptions): Tracer {
    this.events.push('getTracer')
    return new RecordingTracer(this.events)
  }
}

class RecordingLogger implements Logger {
  constructor(private readonly events: string[]) {}

  emit(logRecord: LogRecord): void {
    this.events.push(`log:${String(logRecord.body)}`)
  }

  enabled(): boolean { return true }
}

class RecordingLoggerProvider implements LoggerProvider {
  constructor(private readonly events: string[]) {}

  getLogger(_name: string, _version?: string, _options?: LoggerOptions): Logger {
    this.events.push('getLogger')
    return new RecordingLogger(this.events)
  }
}

afterEach(() => {
  trace.disable()
  logs.disable()
})

describe('Azure Monitor provider lifecycle', () => {
  it('acquires providers only after configuration and uses them for custom operations', async () => {
    const events: string[] = []

    const started = initializeAzureMonitor('InstrumentationKey=test', () => {
      events.push('configure:start')
      trace.disable()
      logs.disable()
      trace.setGlobalTracerProvider(new RecordingTracerProvider(events))
      logs.setGlobalLoggerProvider(new RecordingLoggerProvider(events))
      events.push('configure:end')
    })

    expect(started).toBe(true)
    expect(events.slice(0, 4)).toEqual(['configure:start', 'configure:end', 'getTracer', 'getLogger'])

    await getTelemetry().runOperation('daymark.test.operation', {}, async () => 'done')

    expect(events).toContain('span:daymark.test.operation:start')
    expect(events).toContain('log:daymark.test.operation completed')
    expect(events).toContain(`status:${SpanStatusCode.OK}`)
  })
})
