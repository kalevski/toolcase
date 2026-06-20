import { describe, it, expect } from 'vitest'
import VectorClock from '../src/VectorClock'

describe('VectorClock', () => {
    it('initializes with nodeId', () => {
        const vc = new VectorClock('node1')
        expect(vc.nodeId).toBe('node1')
        expect(vc.getVersion()).toBe(0)
    })

    it('increments own version', () => {
        const vc = new VectorClock('node1')
        vc.increment()
        expect(vc.getVersion()).toBe(1)
        vc.increment()
        expect(vc.getVersion()).toBe(2)
    })

    it('getClock returns a copy', () => {
        const vc = new VectorClock('node1')
        vc.increment()
        const clock = vc.getClock()
        clock.node1 = 999
        expect(vc.getVersion()).toBe(1)
    })

    it('setClock replaces clock data', () => {
        const vc = new VectorClock('node1')
        vc.setClock({ node1: 5, node2: 3 })
        expect(vc.getVersion('node1')).toBe(5)
        expect(vc.getVersion('node2')).toBe(3)
    })

    it('setVersion sets version for a specific node', () => {
        const vc = new VectorClock('node1')
        vc.setVersion(10, 'node2')
        expect(vc.getVersion('node2')).toBe(10)
    })

    it('update merges with max values', () => {
        const vc1 = new VectorClock('node1', { node1: 3, node2: 1 })
        const vc2 = new VectorClock('node2', { node1: 1, node2: 5 })
        vc1.update(vc2)
        expect(vc1.getVersion('node1')).toBe(3)
        expect(vc1.getVersion('node2')).toBe(5)
    })

    it('isAfter detects causal ordering', () => {
        const vc1 = new VectorClock('node1', { node1: 3, node2: 2 })
        const vc2 = new VectorClock('node2', { node1: 1, node2: 2 })
        expect(vc1.isAfter(vc2)).toBe(true)
        expect(vc2.isAfter(vc1)).toBe(false)
    })

    it('isBefore is inverse of isAfter', () => {
        const vc1 = new VectorClock('node1', { node1: 1 })
        const vc2 = new VectorClock('node2', { node1: 3 })
        expect(vc1.isBefore(vc2)).toBe(true)
    })

    it('isConcurrent detects concurrent clocks', () => {
        const vc1 = new VectorClock('node1', { node1: 2, node2: 1 })
        const vc2 = new VectorClock('node2', { node1: 1, node2: 2 })
        expect(vc1.isConcurrent(vc2)).toBe(true)
    })

    it('compare returns correct ordering', () => {
        const vc1 = new VectorClock('node1', { node1: 3 })
        const vc2 = new VectorClock('node2', { node1: 1 })
        expect(VectorClock.compare(vc1, vc2)).toBe(1)
        expect(VectorClock.compare(vc2, vc1)).toBe(-1)
    })

    it('equal clocks are not isAfter in either direction', () => {
        const vc1 = new VectorClock('node1', { node1: 1 })
        const vc2 = new VectorClock('node2', { node1: 1 })
        expect(vc1.isAfter(vc2)).toBe(false)
        expect(vc2.isAfter(vc1)).toBe(false)
        expect(VectorClock.isEqual(vc1, vc2)).toBe(true)
        expect(VectorClock.compare(vc1, vc2)).toBe(0)
        expect(vc1.isConcurrent(vc2)).toBe(false)
        expect(vc1.isBefore(vc2)).toBe(false)
    })

    it('compare returns 0 for concurrent clocks', () => {
        const vc1 = new VectorClock('node1', { node1: 2, node2: 1 })
        const vc2 = new VectorClock('node2', { node1: 1, node2: 2 })
        expect(VectorClock.compare(vc1, vc2)).toBe(0)
    })
})
