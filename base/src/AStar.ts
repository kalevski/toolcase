import Dijkstra from './Dijkstra'
import type { DijkstraOptions, PathResult } from './Dijkstra'

export type Heuristic<N> = (node: N, goal: N) => number

export interface AStarOptions<N> extends DijkstraOptions<N> {
    heuristic: Heuristic<N>
}

class AStar<N> extends Dijkstra<N> {

    protected heuristic: Heuristic<N>

    constructor(start: N, end: N, options: AStarOptions<N>) {
        if (typeof options?.heuristic !== 'function') {
            throw new Error('heuristic is required')
        }
        super(start, end, options)
        this.heuristic = options.heuristic
    }

    static find<N>(start: N, end: N, options: AStarOptions<N>): PathResult<N> | null {
        const search = new AStar(start, end, options)
        return search.run()
    }

    protected override priorityOf(neighbor: N, gCost: number): number {
        const h = this.heuristic(neighbor, this.end)
        if (!Number.isFinite(h) || h < 0) {
            throw new Error('heuristic must return a non-negative finite number')
        }
        return gCost + h
    }

}

export default AStar
