import type SharpDefault from 'sharp'

type SharpFactory = typeof SharpDefault

let cached: SharpFactory | null = null
let pending: Promise<SharpFactory> | null = null

export async function loadSharp(): Promise<SharpFactory> {
    if (cached !== null) return cached
    if (pending !== null) return pending
    pending = import('sharp').then(mod => {
        const factory = (mod as { default?: SharpFactory }).default ?? (mod as unknown as SharpFactory)
        cached = factory
        pending = null
        return factory
    }).catch(error => {
        pending = null
        const cause = error instanceof Error ? error.message : String(error)
        throw new Error(`sharp is not installed — add it as an optional dependency: npm install sharp. Original error: ${cause}`)
    })
    return pending
}
