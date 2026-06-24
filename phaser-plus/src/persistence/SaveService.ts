import type { Disposable } from '../features/ServiceRegistry'
import type { SaveBackend } from './SaveBackend'
import LocalStorageBackend from './LocalStorageBackend'

export interface SaveSchema {
    version: number
    migrations?: Record<number, (data: unknown) => unknown>
}

export interface SaveEntry {
    id: string
    version: number
    savedAt: number
}

export interface SaveConfig {
    backend?: SaveBackend
    namespace?: string
    schema?: SaveSchema
}

interface SaveEnvelope {
    _version: number
    _savedAt: number
    data: unknown
}

class SaveService implements Disposable {

    private readonly backend: SaveBackend
    private readonly namespace: string
    private schema: SaveSchema

    constructor(config: SaveConfig = {}) {
        this.backend = config.backend ?? new LocalStorageBackend()
        this.namespace = config.namespace ?? 'save'
        this.schema = config.schema ?? { version: 1 }
    }

    setSchema(schema: SaveSchema): this {
        this.schema = schema
        return this
    }

    private slotKey(slotId: string): string {
        return `${this.namespace}:${slotId}`
    }

    async save(slotId: string, data: unknown): Promise<void> {
        const envelope: SaveEnvelope = {
            _version: this.schema.version,
            _savedAt: Date.now(),
            data
        }
        await this.backend.save(this.slotKey(slotId), JSON.stringify(envelope))
    }

    async load<T = unknown>(slotId: string): Promise<T | null> {
        const raw = await this.backend.load(this.slotKey(slotId))
        if (raw === null) return null
        const envelope = JSON.parse(raw) as SaveEnvelope
        return this.migrate(envelope) as T
    }

    async delete(slotId: string): Promise<void> {
        await this.backend.delete(this.slotKey(slotId))
    }

    async list(): Promise<SaveEntry[]> {
        const allKeys = await this.backend.keys()
        const prefix = this.namespace + ':'
        const slotKeys = allKeys.filter(k => k.startsWith(prefix))
        const entries: SaveEntry[] = []
        for (const k of slotKeys) {
            const raw = await this.backend.load(k)
            if (raw === null) continue
            try {
                const envelope = JSON.parse(raw) as SaveEnvelope
                entries.push({
                    id: k.slice(prefix.length),
                    version: envelope._version,
                    savedAt: envelope._savedAt
                })
            } catch {
                // skip corrupt entries
            }
        }
        return entries
    }

    async has(slotId: string): Promise<boolean> {
        return (await this.backend.load(this.slotKey(slotId))) !== null
    }

    private migrate(envelope: SaveEnvelope): unknown {
        const { migrations } = this.schema
        if (!migrations) return envelope.data
        let version = envelope._version
        let data = envelope.data
        while (version < this.schema.version) {
            const migrator = migrations[version]
            if (migrator !== undefined) {
                data = migrator(data)
            }
            version++
        }
        return data
    }

    dispose(): void {
        this.backend.dispose()
    }

}

export default SaveService
