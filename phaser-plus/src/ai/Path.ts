import { Broadcast, PriorityQueue } from '@toolcase/base'
import PathNode from './PathNode'

export const PATH_FOUND = 'found'

export const PATH_FAILED = 'failed'

export type Waypoint = { x: number, y: number }

/**
 * Result of a path query. Pooled by `PathFinder`. Listen for `PATH_FOUND` /
 * `PATH_FAILED` events; both fire exactly once per query and the path is
 * recycled immediately after the listeners run.
 */
export default class Path extends Broadcast {

    start: Waypoint = { x: 0, y: 0 }

    end: Waypoint = { x: 0, y: 0 }

    open: PriorityQueue<PathNode> = new PriorityQueue<PathNode>(node => node.F)

    closed: Set<string> = new Set()

    bestG: Map<string, number> = new Map()

    current: PathNode | null = null

    iterations: number = 0

    maxIterations: number = 5000

    setTo(sx: number, sy: number, ex: number, ey: number): this {
        this.start.x = sx
        this.start.y = sy
        this.end.x = ex
        this.end.y = ey
        this.current = null
        this.iterations = 0
        return this
    }

    get inProgress(): boolean {
        if (this.current === null) return true
        return this.current.x !== this.end.x || this.current.y !== this.end.y
    }

    /** @internal — invoked by PathFinder once a goal node is popped. */
    markFound(): void {
        const out: Waypoint[] = []
        let node: PathNode | null = this.current
        while (node !== null) {
            out.unshift({ x: node.x, y: node.y })
            node = node.parent
        }
        this.emit(PATH_FOUND, out)
    }

    /** @internal — invoked by PathFinder when search exhausts or end blocked. */
    markFailed(reason: string): void {
        this.emit(PATH_FAILED, reason)
    }

}
