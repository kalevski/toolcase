import type { SaveBackend } from './SaveBackend'

class MemoryBackend implements SaveBackend {

    private readonly store: Map<string, string> = new Map()

    async save(key: string, value: string): Promise<void> {
        this.store.set(key, value)
    }

    async load(key: string): Promise<string | null> {
        return this.store.get(key) ?? null
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key)
    }

    async keys(): Promise<string[]> {
        return Array.from(this.store.keys())
    }

    dispose(): void {
        this.store.clear()
    }

}

export default MemoryBackend
