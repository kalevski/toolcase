import type { SaveBackend } from './SaveBackend'

class IndexedDBBackend implements SaveBackend {

    private readonly dbName: string
    private readonly storeName: string = 'saves'
    private db: IDBDatabase | null = null
    private readonly ready: Promise<void>

    constructor(dbName: string = 'phaser-plus') {
        this.dbName = dbName
        this.ready = this.open()
    }

    private open(): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, 1)
            req.onupgradeneeded = () => {
                req.result.createObjectStore(this.storeName)
            }
            req.onsuccess = () => {
                this.db = req.result
                resolve()
            }
            req.onerror = () => reject(req.error)
        })
    }

    private store(mode: IDBTransactionMode): IDBObjectStore {
        return this.db!.transaction(this.storeName, mode).objectStore(this.storeName)
    }

    async save(key: string, value: string): Promise<void> {
        await this.ready
        return new Promise((resolve, reject) => {
            const req = this.store('readwrite').put(value, key)
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
        })
    }

    async load(key: string): Promise<string | null> {
        await this.ready
        return new Promise((resolve, reject) => {
            const req = this.store('readonly').get(key)
            req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
            req.onerror = () => reject(req.error)
        })
    }

    async delete(key: string): Promise<void> {
        await this.ready
        return new Promise((resolve, reject) => {
            const req = this.store('readwrite').delete(key)
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
        })
    }

    async keys(): Promise<string[]> {
        await this.ready
        return new Promise((resolve, reject) => {
            const req = this.store('readonly').getAllKeys()
            req.onsuccess = () => resolve(req.result as string[])
            req.onerror = () => reject(req.error)
        })
    }

    dispose(): void {
        this.db?.close()
        this.db = null
    }

}

export default IndexedDBBackend
