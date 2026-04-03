import { describe, it, expect } from 'vitest'
import AdjacencyMatrix from '../src/AdjacencyMatrix.js'

describe('AdjacencyMatrix', () => {
    it('adds vertices', () => {
        const m = new AdjacencyMatrix()
        expect(m.addVertex('A')).toBe(true)
        expect(m.addVertex('B')).toBe(true)
        expect(m.vertices).toEqual(['A', 'B'])
    })

    it('rejects duplicate vertices', () => {
        const m = new AdjacencyMatrix()
        m.addVertex('A')
        expect(m.addVertex('A')).toBe(false)
    })

    it('removes vertices', () => {
        const m = new AdjacencyMatrix()
        m.addVertex('A')
        m.addVertex('B')
        expect(m.removeVertex('A')).toBe(true)
        expect(m.vertices).toEqual(['B'])
    })

    it('removeVertex returns false for nonexistent', () => {
        const m = new AdjacencyMatrix()
        expect(m.removeVertex('X')).toBe(false)
    })

    it('adds and gets edges', () => {
        const m = new AdjacencyMatrix()
        m.addVertex('A')
        m.addVertex('B')
        m.addEdge('A', 'B')
        expect(m.getEdge('A', 'B')).toBe(true)
        expect(m.getEdge('B', 'A')).toBe(false)
    })

    it('adds edges with custom values', () => {
        const m = new AdjacencyMatrix(1, 0)
        m.addVertex('A')
        m.addVertex('B')
        m.addEdge('A', 'B', 5)
        expect(m.getEdge('A', 'B')).toBe(5)
    })

    it('removes edges', () => {
        const m = new AdjacencyMatrix()
        m.addVertex('A')
        m.addVertex('B')
        m.addEdge('A', 'B')
        m.removeEdge('A', 'B')
        expect(m.getEdge('A', 'B')).toBe(false)
    })

    it('getEdges returns connected vertices', () => {
        const m = new AdjacencyMatrix()
        m.addVertex('A')
        m.addVertex('B')
        m.addVertex('C')
        m.addEdge('A', 'B')
        m.addEdge('A', 'C')
        expect(m.getEdges('A')).toEqual(['B', 'C'])
    })

    it('hasEdge works correctly', () => {
        const m = new AdjacencyMatrix()
        m.addVertex('A')
        m.addVertex('B')
        expect(m.hasEdge('A', 'B')).toBe(false)
        m.addEdge('A', 'B')
        expect(m.hasEdge('A', 'B')).toBe(true)
    })

    it('returns false for edge ops on nonexistent vertices', () => {
        const m = new AdjacencyMatrix()
        expect(m.addEdge('A', 'B')).toBe(false)
        expect(m.removeEdge('A', 'B')).toBe(false)
        expect(m.hasEdge('A', 'B')).toBe(false)
    })
})
