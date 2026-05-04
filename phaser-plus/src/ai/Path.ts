import { Broadcast, AStar } from '@toolcase/base'
import type { PathResult } from '@toolcase/base'

export const PATH_FOUND = 'found'

export const PATH_FAILED = 'failed'

export type Waypoint = { x: number, y: number }

export type GridNode = { x: number, y: number }

type Status = 'idle' | 'searching' | 'found' | 'failed'

/**
 * Result of a path query. Listen for `PATH_FOUND` / `PATH_FAILED`; both fire
 * exactly once per query. Backed by an `@toolcase/base` `AStar` instance
 * stepped cooperatively by `PathFinder`.
 */
export default class Path extends Broadcast {

    start: Waypoint = { x: 0, y: 0 }

    end: Waypoint = { x: 0, y: 0 }

    maxIterations: number = 5000

    /** @internal — owned by PathFinder. */
    search: AStar<GridNode> | null = null

    private status: Status = 'idle'

    setTo(sx: number, sy: number, ex: number, ey: number): this {
        this.start.x = sx
        this.start.y = sy
        this.end.x = ex
        this.end.y = ey
        this.status = 'idle'
        return this
    }

    get inProgress(): boolean {
        return this.status === 'idle' || this.status === 'searching'
    }

    /** @internal — invoked by PathFinder when AStar reports FOUND. */
    markFound(result: PathResult<GridNode>): void {
        this.status = 'found'
        const out: Waypoint[] = new Array(result.path.length)
        for (let i = 0; i < result.path.length; i++) {
            const node = result.path[i]
            out[i] = { x: node.x, y: node.y }
        }
        this.emit(PATH_FOUND, out)
    }

    /** @internal — invoked by PathFinder when AStar reports FAILED or end is blocked. */
    markFailed(reason: string): void {
        this.status = 'failed'
        this.emit(PATH_FAILED, reason)
    }

    /** @internal — flip from idle once the search is seeded. */
    markSearching(): void {
        this.status = 'searching'
    }

}
