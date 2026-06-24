import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import BufferedReporter, { type LogEntry } from './BufferedReporter'

export type OTLPTransport = (url: string, body: string, headers: Record<string, string>) => Promise<number>

export interface OTLPReporterOptions {
    url: string
    headers?: Record<string, string>
    resource?: Record<string, any>
    maxSize?: number
    flushInterval?: number
    retries?: number
    retryMinTimeout?: number
    transport?: OTLPTransport
}

type AnyValue =
    | { stringValue: string }
    | { boolValue: boolean }
    | { intValue: string }
    | { doubleValue: number }
    | { arrayValue: { values: AnyValue[] } }
    | { kvlistValue: { values: KeyValue[] } }

type KeyValue = { key: string; value: AnyValue }

const SEVERITY: Record<LoggerLevel, [number, string]> = {
    verbose: [1,  'TRACE'],
    debug:   [5,  'DEBUG'],
    info:    [9,  'INFO'],
    warning: [13, 'WARN'],
    error:   [17, 'ERROR'],
    silent:  [0,  'UNSPECIFIED'],
}

const defaultTransport: OTLPTransport = async (url, body, headers) => {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body,
    })
    return res.status
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const postWithRetry = async (
    url: string,
    body: string,
    headers: Record<string, string>,
    retries: number,
    minTimeout: number,
    transport: OTLPTransport
): Promise<void> => {
    let attempt = 0
    while (true) {
        if (attempt > 0) {
            await sleep(minTimeout * Math.pow(2, attempt - 1))
        }
        try {
            const status = await transport(url, body, headers)
            if (status < 200 || status >= 300) {
                throw new Error(`HTTP ${status}`)
            }
            return
        } catch {
            if (attempt >= retries) return
            attempt++
        }
    }
}

function toAnyValue(v: any): AnyValue {
    if (typeof v === 'string') return { stringValue: v }
    if (typeof v === 'boolean') return { boolValue: v }
    if (typeof v === 'number') {
        return Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v }
    }
    if (typeof v === 'bigint') return { stringValue: String(v) }
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toAnyValue) } }
    if (v !== null && typeof v === 'object') {
        return {
            kvlistValue: {
                values: Object.entries(v).map(([k, val]) => ({ key: k, value: toAnyValue(val) }))
            }
        }
    }
    return { stringValue: String(v) }
}

function toKeyValues(obj: Record<string, any>): KeyValue[] {
    return Object.entries(obj).map(([k, v]) => ({ key: k, value: toAnyValue(v) }))
}

function serializeMessage(m: any): string {
    if (typeof m === 'string') return m
    try { return JSON.stringify(m) } catch { return String(m) }
}

function buildPayload(entries: LogEntry[], resource: Record<string, any>): string {
    const byScope = new Map<string, LogEntry[]>()
    for (const entry of entries) {
        const group = byScope.get(entry.scope)
        if (group) {
            group.push(entry)
        } else {
            byScope.set(entry.scope, [entry])
        }
    }

    const scopeLogs = Array.from(byScope.entries()).map(([scope, scopeEntries]) => ({
        scope: { name: scope },
        logRecords: scopeEntries.map(entry => {
            const [severityNumber, severityText] = SEVERITY[entry.level] ?? [0, 'UNSPECIFIED']
            const attributes: KeyValue[] = [
                { key: 'log.scope', value: { stringValue: scope } },
                ...toKeyValues(entry.fields),
            ]
            return {
                timeUnixNano: String(entry.time * 1_000_000),
                severityNumber,
                severityText,
                body: { stringValue: entry.messages.map(serializeMessage).join(' ') },
                attributes,
            }
        }),
    }))

    return JSON.stringify({
        resourceLogs: [{
            resource: { attributes: toKeyValues(resource) },
            scopeLogs,
        }]
    })
}

class OTLPReporter extends LogReporter {

    private buffer: BufferedReporter

    constructor(options: OTLPReporterOptions) {
        super()
        const {
            url,
            headers = {},
            resource = {},
            maxSize = 50,
            flushInterval = 1000,
            retries = 3,
            retryMinTimeout = 500,
            transport = defaultTransport,
        } = options
        this.buffer = new BufferedReporter(null, {
            maxSize,
            flushInterval,
            onFlush: (entries: LogEntry[]) => {
                const body = buildPayload(entries, resource)
                postWithRetry(url, body, headers, retries, retryMinTimeout, transport).catch(() => {})
            },
        })
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        this.buffer.log(level, scope, time, fields, messages)
    }

    flush(): void {
        this.buffer.flush()
    }

    close(): void {
        this.buffer.close()
    }

}

export default OTLPReporter
