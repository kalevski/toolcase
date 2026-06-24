import type { StorageAdapter } from './types'

export class MemoryAdapter implements StorageAdapter {
    private pages = new Map<number, Uint8Array>()

    async read(pageId: number): Promise<Uint8Array | null> {
        return this.pages.get(pageId) ?? null
    }

    async write(pageId: number, data: Uint8Array): Promise<void> {
        this.pages.set(pageId, data.slice())
    }

    async truncate(pageCount: number): Promise<void> {
        for (const id of [...this.pages.keys()]) {
            if (id >= pageCount) this.pages.delete(id)
        }
    }

    async flush(): Promise<void> { /* no-op for memory */ }
    async close(): Promise<void> { /* no-op for memory */ }
}
