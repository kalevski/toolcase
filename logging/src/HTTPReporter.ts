import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import BufferedReporter, { type LogEntry } from './BufferedReporter'

export type HTTPTransport = (url: string, body: string, headers: Record<string, string>) => Promise<number>

export interface HTTPReporterOptions {
    url: string
    headers?: Record<string, string>
    maxSize?: number
    flushInterval?: number
    retries?: number
    retryMinTimeout?: number
    transport?: HTTPTransport
}

const defaultTransport: HTTPTransport = async (url, body, headers) => {
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
    transport: HTTPTransport
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

class HTTPReporter extends LogReporter {

    private buffer: BufferedReporter

    constructor(options: HTTPReporterOptions) {
        super()
        const {
            url,
            headers = {},
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
                const body = JSON.stringify({ entries })
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

export default HTTPReporter
