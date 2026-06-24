import { describe, it, expect, vi, beforeEach } from 'vitest'
import Feature from '../src/features/Feature'

function makeScene(listenerCount = 0): { scene: any, warnSpy: ReturnType<typeof vi.fn>, emitSpy: ReturnType<typeof vi.fn> } {
    const warnSpy = vi.fn()
    const emitSpy = vi.fn().mockReturnValue(true)
    const logger = { warning: warnSpy }
    const engine = { getLogger: vi.fn().mockReturnValue(logger) }
    const features = {
        listenerCount: vi.fn().mockReturnValue(listenerCount),
        emit: emitSpy,
    }
    const scene = { game: {}, engine, features }
    return { scene, warnSpy, emitSpy }
}

class TestFeature extends Feature {
    callEmit(event: string, ...args: unknown[]) {
        this.emit(event, ...args)
    }

    callSuppressWarning(...events: string[]) {
        this.suppressWarning(...events)
    }
}

describe('Feature.emit', () => {
    describe('no listener registered', () => {
        it('warns by default when no listener is registered', () => {
            const { scene, warnSpy } = makeScene(0)
            const feature = new TestFeature(scene, 'test')
            feature.callEmit('player:died', { score: 100 })
            expect(warnSpy).toHaveBeenCalledOnce()
            expect(warnSpy.mock.calls[0][0]).toContain('player:died')
        })

        it('does not call features.emit when no listener is registered', () => {
            const { scene, emitSpy } = makeScene(0)
            const feature = new TestFeature(scene, 'test')
            feature.callEmit('player:died')
            expect(emitSpy).not.toHaveBeenCalled()
        })

        it('includes the event payload in the warning', () => {
            const { scene, warnSpy } = makeScene(0)
            const feature = new TestFeature(scene, 'test')
            feature.callEmit('ui:ready', 'arg1', 42)
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('ui:ready'),
                'arg1',
                42,
            )
        })
    })

    describe('suppressWarning', () => {
        it('suppresses the warning for a single opted-out event', () => {
            const { scene, warnSpy } = makeScene(0)
            const feature = new TestFeature(scene, 'test')
            feature.callSuppressWarning('analytics:purchase')
            feature.callEmit('analytics:purchase', { amount: 9.99 })
            expect(warnSpy).not.toHaveBeenCalled()
        })

        it('still warns for events that were not opted-out', () => {
            const { scene, warnSpy } = makeScene(0)
            const feature = new TestFeature(scene, 'test')
            feature.callSuppressWarning('analytics:purchase')
            feature.callEmit('player:died')
            expect(warnSpy).toHaveBeenCalledOnce()
        })

        it('suppresses warnings for multiple events passed in one call', () => {
            const { scene, warnSpy } = makeScene(0)
            const feature = new TestFeature(scene, 'test')
            feature.callSuppressWarning('event:a', 'event:b')
            feature.callEmit('event:a')
            feature.callEmit('event:b')
            expect(warnSpy).not.toHaveBeenCalled()
        })

        it('does not emit to features when there are no listeners even after suppressWarning', () => {
            const { scene, emitSpy } = makeScene(0)
            const feature = new TestFeature(scene, 'test')
            feature.callSuppressWarning('ambient:cue')
            feature.callEmit('ambient:cue')
            expect(emitSpy).not.toHaveBeenCalled()
        })
    })

    describe('with listeners', () => {
        it('forwards the event and payload when listeners exist', () => {
            const { scene, emitSpy } = makeScene(1)
            const feature = new TestFeature(scene, 'test')
            feature.callEmit('player:scored', 500)
            expect(emitSpy).toHaveBeenCalledWith('player:scored', 500)
        })

        it('does not warn when listeners exist', () => {
            const { scene, warnSpy } = makeScene(1)
            const feature = new TestFeature(scene, 'test')
            feature.callEmit('player:scored', 500)
            expect(warnSpy).not.toHaveBeenCalled()
        })
    })
})
