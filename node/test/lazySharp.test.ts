import { describe, it, expect, vi } from 'vitest'

describe('lazySharp - missing peer', () => {
    it('wraps missing-module error with friendly install message', async () => {
        // Reset module registry so lazySharp gets a fresh instance (cached = null, pending = null)
        vi.resetModules()
        // Mock sharp to simulate it not being installed
        vi.doMock('sharp', () => {
            throw new Error("Cannot find module 'sharp'")
        })

        const { loadSharp } = await import('../src/internal/lazySharp')

        await expect(loadSharp()).rejects.toThrow(/install sharp/)

        vi.doUnmock('sharp')
        vi.resetModules()
    })
})
