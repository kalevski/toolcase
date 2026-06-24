import type { StorageAdapter } from './types'

/**
 * LRU buffer pool that wraps any StorageAdapter.
 * Reads are served from the in-memory cache on hits and delegated to the inner
 * adapter on misses; the returned page is then stored for future hits.
 * Writes are write-through: the page is sent to the inner adapter AND the cache
 * is updated with the new bytes so subsequent reads do not re-fetch.
 * Truncate evicts cached entries for all pages that fall outside the new boundary.
 * Because BPlusIndex uses copy-on-write allocation, a cached Uint8Array is never
 * silently overwritten by a different write — a page id is either absent or
 * immutable once written (superblock pages 0 and 1 are the only exception; they
 * are always written through and the cache is kept consistent).
 */
export class PageCache implements StorageAdapter {
    private readonly lru = new Map<number, Uint8Array>()
    private readonly maxSize: number

    constructor(
        private readonly inner: StorageAdapter,
        maxSize = 64,
    ) {
        if (maxSize < 1) throw new Error('PageCache: maxSize must be at least 1')
        this.maxSize = maxSize
    }

    async read(pageId: number): Promise<Uint8Array | null> {
        const hit = this.lru.get(pageId)
        if (hit !== undefined) {
            this.lru.delete(pageId)
            this.lru.set(pageId, hit)
            return hit
        }
        const data = await this.inner.read(pageId)
        if (data !== null) this._put(pageId, data)
        return data
    }

    async write(pageId: number, data: Uint8Array): Promise<void> {
        await this.inner.write(pageId, data)
        this._put(pageId, data.slice())
    }

    async truncate(pageCount: number): Promise<void> {
        if (this.inner.truncate) await this.inner.truncate(pageCount)
        for (const id of [...this.lru.keys()]) {
            if (id >= pageCount) this.lru.delete(id)
        }
    }

    async flush(): Promise<void> {
        if (this.inner.flush) await this.inner.flush()
    }

    async close(): Promise<void> {
        if (this.inner.close) await this.inner.close()
    }

    private _put(pageId: number, data: Uint8Array): void {
        if (this.lru.has(pageId)) {
            this.lru.delete(pageId)
        } else if (this.lru.size >= this.maxSize) {
            this.lru.delete(this.lru.keys().next().value as number)
        }
        this.lru.set(pageId, data)
    }
}
