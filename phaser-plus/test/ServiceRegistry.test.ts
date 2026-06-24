import { describe, it, expect, vi } from 'vitest'
import ServiceRegistry from '../src/features/ServiceRegistry'

class BasicService {
    value = 42
}

class DisposableService {
    dispose = vi.fn()
}

describe('ServiceRegistry', () => {
    describe('dispose(cls)', () => {
        it('calls dispose() on a resolved disposable instance', () => {
            const registry = new ServiceRegistry()
            const instance = registry.resolve(DisposableService)
            registry.dispose(DisposableService)
            expect(instance.dispose).toHaveBeenCalledOnce()
        })

        it('removes the instance after dispose', () => {
            const registry = new ServiceRegistry()
            registry.resolve(DisposableService)
            registry.dispose(DisposableService)
            expect(registry.has(DisposableService)).toBe(false)
        })

        it('does not throw for a non-disposable service', () => {
            const registry = new ServiceRegistry()
            registry.resolve(BasicService)
            expect(() => registry.dispose(BasicService)).not.toThrow()
        })

        it('does not throw when called on an unresolved service', () => {
            const registry = new ServiceRegistry()
            expect(() => registry.dispose(BasicService)).not.toThrow()
        })

        it('calls dispose() on a provided instance', () => {
            const registry = new ServiceRegistry()
            const instance = new DisposableService()
            registry.provide(DisposableService, instance)
            registry.dispose(DisposableService)
            expect(instance.dispose).toHaveBeenCalledOnce()
        })
    })

    describe('disposeAll()', () => {
        it('calls dispose() on every disposable instance', () => {
            const registry = new ServiceRegistry()
            const a = registry.resolve(DisposableService)

            class OtherDisposable {
                dispose = vi.fn()
            }
            const b = registry.resolve(OtherDisposable)

            registry.disposeAll()
            expect(a.dispose).toHaveBeenCalledOnce()
            expect(b.dispose).toHaveBeenCalledOnce()
        })

        it('does not throw when mixed disposable and non-disposable services exist', () => {
            const registry = new ServiceRegistry()
            registry.resolve(BasicService)
            registry.resolve(DisposableService)
            expect(() => registry.disposeAll()).not.toThrow()
        })

        it('clears all instances and factories', () => {
            const registry = new ServiceRegistry()
            registry.resolve(BasicService)
            registry.resolve(DisposableService)
            registry.disposeAll()
            expect(registry.has(BasicService)).toBe(false)
            expect(registry.has(DisposableService)).toBe(false)
        })

        it('does not call dispose() on non-disposable services', () => {
            const registry = new ServiceRegistry()
            const instance = registry.resolve(BasicService)
            expect(() => registry.disposeAll()).not.toThrow()
            expect((instance as any).dispose).toBeUndefined()
        })
    })
})
