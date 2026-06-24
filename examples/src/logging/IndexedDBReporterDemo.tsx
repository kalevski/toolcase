import { useState } from 'react'
import { LoggerFactory } from '@toolcase/logging'
import { IndexedDBReporter } from '@toolcase/logging/browser'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory } from '@toolcase/logging'
import { IndexedDBReporter } from '@toolcase/logging/browser'

// --- on startup: drain any entries buffered from the previous session ---
const reporter = new IndexedDBReporter({
    dbName: '@toolcase/logging',  // default
    storeName: 'log-entries',     // default
    maxEntries: 1000,             // oldest evicted when exceeded (default)
})

const buffered = await reporter.drain()
if (buffered.length > 0) {
    await fetch('/upload-logs', { method: 'POST', body: JSON.stringify(buffered) })
}

// --- normal usage ---
const factory = new LoggerFactory([reporter])
factory.level = 'error'

const log = factory.getLogger('checkout')
log.error('payment gateway timeout', { orderId: 'ord-42', ms: 5100 })

// flush() waits for all pending writes
await reporter.flush()

// drain() reads + clears the store; call on next startup to upload
const entries = await reporter.drain()
console.log(entries)`

function makeFakeIDB() {
    const stores: Record<string, { data: Map<number, any>; nextKey: number }> = {}

    function makeRequest<T>(result: T) {
        const req: any = { result, error: null, onsuccess: null, onerror: null }
        Promise.resolve().then(() => req.onsuccess?.({ target: req }))
        return req
    }

    function makeObjectStore(name: string) {
        const s = stores[name]
        return {
            add(value: any) {
                const key = s.nextKey++
                s.data.set(key, value)
                return makeRequest(key)
            },
            count() { return makeRequest(s.data.size) },
            openCursor() {
                const keys = [...s.data.keys()].sort((a, b) => a - b)
                let idx = 0
                const req: any = { result: null, error: null, onsuccess: null, onerror: null }
                const advance = () => {
                    if (idx < keys.length) {
                        const k = keys[idx]
                        req.result = {
                            primaryKey: k,
                            value: s.data.get(k),
                            delete() { s.data.delete(k) },
                            continue() {
                                idx++
                                Promise.resolve().then(() => { advance(); req.onsuccess?.({ target: req }) })
                            }
                        }
                    } else {
                        req.result = null
                    }
                }
                Promise.resolve().then(() => { advance(); req.onsuccess?.({ target: req }) })
                return req
            },
            getAll() { return makeRequest([...s.data.values()]) },
            clear() { s.data.clear(); return makeRequest(undefined) },
        }
    }

    function makeDB() {
        return {
            objectStoreNames: { contains: (name: string) => name in stores },
            createObjectStore(name: string, _opts?: any) {
                stores[name] = { data: new Map(), nextKey: 1 }
                return makeObjectStore(name)
            },
            transaction(storeName: string, _mode?: string) {
                const tx: any = { oncomplete: null, onerror: null, objectStore: () => makeObjectStore(storeName) }
                setTimeout(() => tx.oncomplete?.(), 0)
                return tx
            },
            close() {},
        }
    }

    const db = makeDB()
    return {
        open(_name: string, _version: number) {
            const req: any = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }
            Promise.resolve().then(() => {
                req.result = db
                req.onupgradeneeded?.({ target: req })
                Promise.resolve().then(() => req.onsuccess?.({ target: req }))
            })
            return req
        },
    }
}

const IndexedDBReporterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = async () => {
        const entries: LogEntry[] = []
        const origIDB = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = makeFakeIDB()

        try {
            const reporter = new IndexedDBReporter({ maxEntries: 1000 })
            const factory = new LoggerFactory([reporter])
            factory.level = 'error'
            const log = factory.getLogger('checkout')

            log.error('payment gateway timeout', { orderId: 'ord-42', ms: 5100 })
            log.error('cart service unavailable', { code: 503 })

            await reporter.flush()

            const stored = await reporter.drain()
            entries.push({
                time: new Date().toLocaleTimeString(),
                text: `drain() returned ${stored.length} entr${stored.length === 1 ? 'y' : 'ies'} from IndexedDB:`,
                level: 'info',
            })
            for (const e of stored) {
                entries.push({
                    time: '',
                    text: `  [${e.scope}] ${e.level.toUpperCase()}: ${e.messages.map((m: unknown) =>
                        typeof m === 'object' ? JSON.stringify(m) : String(m)
                    ).join(' ')}`,
                    level: e.level,
                })
            }

            const second = await reporter.drain()
            entries.push({
                time: new Date().toLocaleTimeString(),
                text: `second drain() returned ${second.length} entries (store was cleared)`,
                level: 'info',
            })
        } finally {
            ;(globalThis as any).indexedDB = origIDB
        }

        setLogs([...entries])
    }

    return (
        <LoggingDemoCard
            title="IndexedDBReporter"
            description={
                <>
                    Persists log entries to <code>IndexedDB</code> so they survive page reloads.
                    Call <code>drain()</code> on the next startup to retrieve and clear the stored
                    entries for upload — ideal for capturing errors before a page crash. Oldest
                    entries are evicted automatically when <code>maxEntries</code> is exceeded.
                    Browser only (<code>@toolcase/logging/browser</code>).
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default IndexedDBReporterDemo
