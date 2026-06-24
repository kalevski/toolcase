import type { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import BufferedReporter, { type LogEntry } from './BufferedReporter'

export interface BeaconReporterOptions {
    url: string
    maxSize?: number
    flushInterval?: number
    captureErrors?: boolean
    errorScope?: string
}

class BeaconReporter extends LogReporter {

    private buffer: BufferedReporter
    private errorScope: string

    constructor(options: BeaconReporterOptions) {
        super()
        if (typeof navigator === 'undefined' || typeof (navigator as any).sendBeacon !== 'function') {
            throw new Error('BeaconReporter requires navigator.sendBeacon (browser only)')
        }
        const {
            url,
            maxSize = 50,
            flushInterval = 0,
            captureErrors = false,
            errorScope = 'window',
        } = options
        this.errorScope = errorScope
        this.buffer = new BufferedReporter(null, {
            maxSize,
            flushInterval,
            onFlush: (entries: LogEntry[]) => {
                try {
                    navigator.sendBeacon(url, JSON.stringify(entries))
                } catch {
                    // never propagate
                }
            },
        })
        if (captureErrors) {
            this.installErrorHandlers()
        }
    }

    private installErrorHandlers(): void {
        const self = this
        if (typeof window === 'undefined') return
        const prevOnError = typeof window.onerror === 'function' ? window.onerror : null
        window.onerror = function (message, source, lineno, colno, error) {
            const msg = error ?? (typeof message === 'string' ? message : String(message))
            self.log('error', self.errorScope, Date.now(), {}, [msg, { source, lineno, colno }])
            if (prevOnError) return (prevOnError as any)(message, source, lineno, colno, error)
            return false
        }
        window.addEventListener('unhandledrejection', (evt: PromiseRejectionEvent) => {
            const reason = evt.reason instanceof Error ? evt.reason : { reason: evt.reason }
            self.log('error', self.errorScope, Date.now(), {}, ['Unhandled promise rejection', reason])
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

export default BeaconReporter
