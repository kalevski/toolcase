import type { SaveBackend } from './SaveBackend'

class LocalStorageBackend implements SaveBackend {

    private readonly prefix: string

    constructor(appPrefix: string = 'phaser-plus') {
        this.prefix = appPrefix + ':'
    }

    private storageKey(key: string): string {
        return this.prefix + key
    }

    async save(key: string, value: string): Promise<void> {
        localStorage.setItem(this.storageKey(key), value)
    }

    async load(key: string): Promise<string | null> {
        return localStorage.getItem(this.storageKey(key))
    }

    async delete(key: string): Promise<void> {
        localStorage.removeItem(this.storageKey(key))
    }

    async keys(): Promise<string[]> {
        const result: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k !== null && k.startsWith(this.prefix)) {
                result.push(k.slice(this.prefix.length))
            }
        }
        return result
    }

    dispose(): void {}

}

export default LocalStorageBackend
