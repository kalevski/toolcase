export interface SaveBackend {
    save(key: string, value: string): Promise<void>
    load(key: string): Promise<string | null>
    delete(key: string): Promise<void>
    keys(): Promise<string[]>
    dispose(): void
}
