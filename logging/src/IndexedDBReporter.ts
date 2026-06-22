import type { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import type { LogEntry } from './BufferedReporter'

export interface IndexedDBReporterOptions {
    dbName?: string
    storeName?: string
    maxEntries?: number
}

class IndexedDBReporter extends LogReporter {

    private readonly dbName: string
    private readonly storeName: string
    private readonly maxEntries: number
    private readonly dbPromise: Promise<IDBDatabase>
    private writeChain: Promise<void> = Promise.resolve()
    private closed = false

    constructor(options: IndexedDBReporterOptions = {}) {
        super()
        if (typeof indexedDB === 'undefined') {
            throw new Error('IndexedDBReporter requires IndexedDB (browser only)')
        }
        this.dbName = options.dbName ?? '@toolcase/logging'
        this.storeName = options.storeName ?? 'log-entries'
        this.maxEntries = options.maxEntries ?? 1000
        this.dbPromise = this.openDB()
    }

    private openDB(): Promise<IDBDatabase> {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(this.dbName, 1)
            req.onupgradeneeded = () => {
                const db = req.result
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { autoIncrement: true })
                }
            }
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        if (this.closed) return
        const entry: LogEntry = { level, scope, time, fields, messages }
        this.writeChain = this.writeChain.then(() => this.write(entry)).catch(() => {})
    }

    private write(entry: LogEntry): Promise<void> {
        return this.dbPromise.then(db => new Promise<void>((resolve) => {
            const tx = db.transaction(this.storeName, 'readwrite')
            const store = tx.objectStore(this.storeName)
            store.add(entry)
            const countReq = store.count()
            countReq.onsuccess = () => {
                const excess = (countReq.result as number) - this.maxEntries
                if (excess > 0) {
                    let deleted = 0
                    const cursorReq = store.openCursor()
                    cursorReq.onsuccess = () => {
                        const cursor = (cursorReq as IDBRequest<IDBCursorWithValue | null>).result
                        if (cursor && deleted < excess) {
                            cursor.delete()
                            deleted++
                            cursor.continue()
                        }
                    }
                }
            }
            tx.oncomplete = () => resolve()
            tx.onerror = () => resolve()
        })).catch(() => {})
    }

    flush(): Promise<void> {
        return this.writeChain
    }

    drain(): Promise<LogEntry[]> {
        return this.writeChain.then(() => this.dbPromise.then(db => new Promise<LogEntry[]>((resolve) => {
            const tx = db.transaction(this.storeName, 'readwrite')
            const store = tx.objectStore(this.storeName)
            const getAllReq = store.getAll()
            getAllReq.onsuccess = () => {
                const entries = getAllReq.result as LogEntry[]
                store.clear()
                tx.oncomplete = () => resolve(entries)
            }
            getAllReq.onerror = () => resolve([])
            tx.onerror = () => resolve([])
        }))).catch(() => [])
    }

    close(): Promise<void> {
        this.closed = true
        return this.flush().then(() => {
            this.dbPromise.then(db => db.close()).catch(() => {})
        })
    }

}

export default IndexedDBReporter
