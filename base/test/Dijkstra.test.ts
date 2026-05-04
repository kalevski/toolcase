import { describe, it, expect, vi } from 'vitest'
import Dijkstra from '../src/Dijkstra'

interface Edge {
    to: string
    cost: number
}

const buildGraph = (edges: Record<string, Edge[]>) => ({
    neighbors: (node: string) => (edges[node] ?? []).map(e => e.to),
    cost: (from: string, to: string) => {
        const list = edges[from] ?? []
        const found = list.find(e => e.to === to)
        return found ? found.cost : Infinity
    }
})

describe('Dijkstra', () => {

    it('throws if neighbors is missing', () => {
        expect(() => new Dijkstra('A', 'B', { cost: () => 1 } as any)).toThrow('neighbors is required')
    })

    it('throws if cost is missing', () => {
        expect(() => new Dijkstra('A', 'B', { neighbors: () => [] } as any)).toThrow('cost is required')
    })

    it('throws if a step cost is negative', () => {
        const graph = buildGraph({ A: [{ to: 'B', cost: -1 }] })
        const search = new Dijkstra('A', 'B', graph)
        expect(() => search.run()).toThrow('cost must be a non-negative finite number')
    })

    it('finds the shortest path on a simple weighted graph (run)', () => {
        const graph = buildGraph({
            A: [{ to: 'B', cost: 1 }, { to: 'C', cost: 4 }],
            B: [{ to: 'C', cost: 2 }, { to: 'D', cost: 5 }],
            C: [{ to: 'D', cost: 1 }],
            D: []
        })
        const result = new Dijkstra('A', 'D', graph).run()
        expect(result).not.toBeNull()
        expect(result!.path).toEqual(['A', 'B', 'C', 'D'])
        expect(result!.cost).toBe(4)
    })

    it('Dijkstra.find static helper matches run()', () => {
        const graph = buildGraph({ A: [{ to: 'B', cost: 1 }], B: [] })
        const result = Dijkstra.find('A', 'B', graph)
        expect(result).toEqual({ path: ['A', 'B'], cost: 1 })
    })

    it('returns start-only path with cost 0 when start equals end', () => {
        const graph = buildGraph({ A: [] })
        const result = new Dijkstra('A', 'A', graph).run()
        expect(result).toEqual({ path: ['A'], cost: 0 })
    })

    it('returns null when end is unreachable', () => {
        const graph = buildGraph({ A: [{ to: 'B', cost: 1 }], B: [], C: [] })
        const result = new Dijkstra('A', 'C', graph).run()
        expect(result).toBeNull()
    })

    it('manual step transitions through searching → found', () => {
        const graph = buildGraph({ A: [{ to: 'B', cost: 1 }], B: [] })
        const search = new Dijkstra('A', 'B', graph)
        expect(search.getStatus()).toBe('searching')
        expect(search.step()).toBe('searching')
        expect(search.step()).toBe('found')
        expect(search.isComplete).toBe(true)
        expect(search.getStatus()).toBe('found')
    })

    it('emits found event with PathResult', () => {
        const graph = buildGraph({ A: [{ to: 'B', cost: 2 }], B: [] })
        const search = new Dijkstra('A', 'B', graph)
        const found = vi.fn()
        search.on(Dijkstra.FOUND, found)
        search.run()
        expect(found).toHaveBeenCalledWith({ path: ['A', 'B'], cost: 2 })
    })

    it('emits failed event with exhausted reason', () => {
        const graph = buildGraph({ A: [{ to: 'B', cost: 1 }], B: [] })
        const search = new Dijkstra('A', 'Z', graph)
        const failed = vi.fn()
        search.on(Dijkstra.FAILED, failed)
        search.run()
        expect(failed).toHaveBeenCalledWith('exhausted')
    })

    it('emits failed event with max_iterations reason when capped', () => {
        const graph = buildGraph({
            A: [{ to: 'B', cost: 1 }],
            B: [{ to: 'C', cost: 1 }],
            C: [{ to: 'D', cost: 1 }],
            D: []
        })
        const search = new Dijkstra('A', 'D', graph)
        search.maxIterations = 2
        const failed = vi.fn()
        search.on(Dijkstra.FAILED, failed)
        const result = search.run()
        expect(result).toBeNull()
        expect(failed).toHaveBeenCalledWith('max_iterations')
    })

    it('emits visit + open events during search', () => {
        const graph = buildGraph({ A: [{ to: 'B', cost: 1 }], B: [] })
        const search = new Dijkstra('A', 'B', graph)
        const visit = vi.fn()
        const open = vi.fn()
        search.on(Dijkstra.VISIT, visit)
        search.on(Dijkstra.OPEN, open)
        search.run()
        expect(visit).toHaveBeenCalledWith('A', 0)
        expect(visit).toHaveBeenCalledWith('B', 1)
        expect(open).toHaveBeenCalledWith('B', 1)
    })

    it('uses hash for non-string nodes', () => {
        type Cell = { x: number, y: number }
        const grid: Cell[][] = [
            [{ x: 0, y: 0 }, { x: 1, y: 0 }],
            [{ x: 0, y: 1 }, { x: 1, y: 1 }]
        ]
        const result = new Dijkstra(grid[0][0], grid[1][1], {
            neighbors: (n) => {
                const out: Cell[] = []
                if (n.x < 1) out.push(grid[n.y][n.x + 1])
                if (n.y < 1) out.push(grid[n.y + 1][n.x])
                return out
            },
            cost: () => 1,
            hash: (n) => `${n.x},${n.y}`
        }).run()
        expect(result!.cost).toBe(2)
        expect(result!.path).toHaveLength(3)
    })

    it('picks the cheaper of multiple routes', () => {
        const graph = buildGraph({
            A: [{ to: 'B', cost: 10 }, { to: 'C', cost: 1 }],
            B: [{ to: 'D', cost: 1 }],
            C: [{ to: 'D', cost: 1 }],
            D: []
        })
        const result = new Dijkstra('A', 'D', graph).run()
        expect(result!.path).toEqual(['A', 'C', 'D'])
        expect(result!.cost).toBe(2)
    })

    it('run(maxSteps) returns null while still searching', () => {
        const graph = buildGraph({
            A: [{ to: 'B', cost: 1 }],
            B: [{ to: 'C', cost: 1 }],
            C: [{ to: 'D', cost: 1 }],
            D: []
        })
        const search = new Dijkstra('A', 'D', graph)
        const partial = search.run(1)
        expect(partial).toBeNull()
        expect(search.getStatus()).toBe('searching')
        const final = search.run()
        expect(final!.cost).toBe(3)
    })
})
