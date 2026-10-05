// Namespaced localStorage. Every access is wrapped: private windows and
// blocked site data make it throw or return nothing, and the app must work
// regardless.
const PREFIX = 'webmail:'

export function readStore<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(PREFIX + key)
        return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
        return fallback
    }
}

export function writeStore(key: string, value: unknown): void {
    try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
        // storage unavailable — in-memory only
    }
}

export function removeStore(key: string): void {
    try {
        window.localStorage.removeItem(PREFIX + key)
    } catch {
        // ignore
    }
}
