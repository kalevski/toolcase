import { describe, it, expect, vi } from 'vitest'
import AStar from '../src/AStar'
import Dijkstra from '../src/Dijkstra'

describe('AStar', () => {

    it('throws if neighbors is missing', () => {
        expect(() => new AStar('A', 'B', { cost: () => 1, heuristic: () => 0 } as any)).toThrow('neighbors is required')
    })

    it('throws if cost is missing', () => {
        expect(() => new AStar('A', 'B', { neighbors: () => [], heuristic: () => 0 } as any)).toThrow('cost is required')
    })

    it('throws if heuristic is missing', () => {
        expect(() => new AStar('A', 'B', { neighbors: () => [], cost: () => 1 } as any)).toThrow('heuristic is required')
    })

    it('throws if heuristic returns negative', () => {
        const search = new AStar('A', 'B', {
            neighbors: (n) => n === 'A' ? ['B'] : [],
            cost: () => 1,
            heuristic: () => -1
        })
        expect(() => search.run()).toThrow('heuristic must return a non-negative finite number')
    })

    it('throws on negative step cost', () => {
        const search = new AStar('A', 'B', {
            neighbors: (n) => n === 'A' ? ['B'] : [],
            cost: () => -1,
            heuristic: () => 0
        })
        expect(() => search.run()).toThrow('cost must be a non-negative finite number')
    })

    it('finds the shortest path on a 4-connected grid', () => {
        type Cell = { x: number, y: number }
        const SIZE = 5
        const cell = (x: number, y: number): Cell => ({ x, y })
        const inBounds = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < SIZE && c.y < SIZE
        const result = new AStar(cell(0, 0), cell(4, 4), {
            neighbors: (n) => [cell(n.x + 1, n.y), cell(n.x - 1, n.y), cell(n.x, n.y + 1), cell(n.x, n.y - 1)].filter(inBounds),
            cost: () => 1,
            heuristic: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
            hash: (n) => `${n.x},${n.y}`
        }).run()
        expect(result).not.toBeNull()
        expect(result!.cost).toBe(8)
        expect(result!.path[0]).toEqual({ x: 0, y: 0 })
        expect(result!.path[result!.path.length - 1]).toEqual({ x: 4, y: 4 })
    })

    it('matches dijkstra cost when heuristic is zero', () => {
        const edges: Record<string, [string, number][]> = {
            A: [['B', 1], ['C', 4]],
            B: [['C', 2], ['D', 5]],
            C: [['D', 1]],
            D: []
        }
        const result = new AStar('A', 'D', {
            neighbors: (n) => (edges[n] ?? []).map(([t]) => t),
            cost: (from, to) => edges[from].find(([t]) => t === to)![1],
            heuristic: () => 0
        }).run()
        expect(result!.cost).toBe(4)
        expect(result!.path).toEqual(['A', 'B', 'C', 'D'])
    })

    it('returns null when goal unreachable', () => {
        const result = new AStar('A', 'Z', {
            neighbors: () => [],
            cost: () => 1,
            heuristic: () => 0
        }).run()
        expect(result).toBeNull()
    })

    it('returns start-only path when start equals end', () => {
        const result = new AStar('X', 'X', {
            neighbors: () => [],
            cost: () => 1,
            heuristic: () => 0
        }).run()
        expect(result).toEqual({ path: ['X'], cost: 0 })
    })

    it('AStar.find static helper matches run()', () => {
        const result = AStar.find('A', 'B', {
            neighbors: (n) => n === 'A' ? ['B'] : [],
            cost: () => 5,
            heuristic: () => 0
        })
        expect(result).toEqual({ path: ['A', 'B'], cost: 5 })
    })

    it('emits found event when goal reached', () => {
        const found = vi.fn()
        const search = new AStar('A', 'B', {
            neighbors: (n) => n === 'A' ? ['B'] : [],
            cost: () => 1,
            heuristic: () => 0
        })
        search.on(AStar.FOUND, found)
        search.run()
        expect(found).toHaveBeenCalledWith({ path: ['A', 'B'], cost: 1 })
    })

    it('emits failed event when goal unreachable', () => {
        const failed = vi.fn()
        const search = new AStar('A', 'Z', {
            neighbors: () => [],
            cost: () => 1,
            heuristic: () => 0
        })
        search.on(AStar.FAILED, failed)
        search.run()
        expect(failed).toHaveBeenCalledWith('exhausted')
    })

    it('manual step works the same as Dijkstra', () => {
        const search = new AStar('A', 'B', {
            neighbors: (n) => n === 'A' ? ['B'] : [],
            cost: () => 1,
            heuristic: () => 0
        })
        expect(search.step()).toBe('searching')
        expect(search.step()).toBe('found')
    })

    it('inherits Dijkstra event constants', () => {
        expect(AStar.FOUND).toBe(Dijkstra.FOUND)
        expect(AStar.FAILED).toBe(Dijkstra.FAILED)
        expect(AStar.VISIT).toBe(Dijkstra.VISIT)
        expect(AStar.OPEN).toBe(Dijkstra.OPEN)
    })

    it('expands fewer nodes than Dijkstra with a good heuristic', () => {
        type Cell = { x: number, y: number }
        const SIZE = 8
        const cell = (x: number, y: number): Cell => ({ x, y })
        const inBounds = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < SIZE && c.y < SIZE
        const opts = {
            neighbors: (n: Cell) => [cell(n.x + 1, n.y), cell(n.x - 1, n.y), cell(n.x, n.y + 1), cell(n.x, n.y - 1)].filter(inBounds),
            cost: () => 1,
            hash: (n: Cell) => `${n.x},${n.y}`
        }
        const dij = new Dijkstra(cell(0, 0), cell(7, 7), opts)
        dij.run()
        const astar = new AStar(cell(0, 0), cell(7, 7), {
            ...opts,
            heuristic: (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
        })
        astar.run()
        expect(astar.iterations).toBeLessThanOrEqual(dij.iterations)
    })
})
