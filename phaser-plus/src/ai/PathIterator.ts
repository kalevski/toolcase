import type { ObjectPool } from '@toolcase/base'
import NavMesh from './NavMesh'
import Path from './Path'
import PathNode from './PathNode'

const STRAIGHT = 1

const DIAG = Math.SQRT2

const NEIGHBOURS_8: ReadonlyArray<readonly [number, number, number]> = [
    [ 1,  0, STRAIGHT],
    [-1,  0, STRAIGHT],
    [ 0,  1, STRAIGHT],
    [ 0, -1, STRAIGHT],
    [ 1,  1, DIAG],
    [ 1, -1, DIAG],
    [-1,  1, DIAG],
    [-1, -1, DIAG]
]

export type StepResult = 'progress' | 'found' | 'failed'

/**
 * Stateless A* expansion driver. Holds a reference to the shared `PathNode`
 * pool so each step can mint nodes without per-call allocation.
 *
 * Closed set + per-id bestG map together implement the standard A* relaxation:
 * stale duplicates that pop later are discarded; better-G replacements always
 * surface first because their F is lower.
 */
export default class PathIterator {

    private readonly nodePool: ObjectPool<PathNode>

    constructor(nodePool: ObjectPool<PathNode>) {
        this.nodePool = nodePool
    }

    private idOf(x: number, y: number): string {
        return `${x}|${y}`
    }

    /** Octile (8-conn admissible) heuristic. */
    private heuristic(ax: number, ay: number, bx: number, by: number): number {
        const dx = Math.abs(ax - bx)
        const dy = Math.abs(ay - by)
        return STRAIGHT * (dx + dy) + (DIAG - 2 * STRAIGHT) * Math.min(dx, dy)
    }

    /** Seed the open queue with the start node. Call once before stepping. */
    seed(path: Path): void {
        const id = this.idOf(path.start.x, path.start.y)
        const node = this.nodePool.obtain()
        node.setTo(
            path.start.x,
            path.start.y,
            id,
            0,
            this.heuristic(path.start.x, path.start.y, path.end.x, path.end.y),
            null
        )
        path.bestG.set(id, 0)
        path.open.enqueue(node)
    }

    /** Run one A* expansion. */
    step(path: Path, mesh: NavMesh): StepResult {
        if (path.iterations >= path.maxIterations) return 'failed'

        let current = path.open.dequeue()
        // Skip stale duplicates: a better-G version was enqueued later.
        while (current !== null) {
            const best = path.bestG.get(current.id)
            if (best !== undefined && current.G > best) {
                ;(current as any).release()
                current = path.open.dequeue()
                continue
            }
            break
        }
        if (current === null) return 'failed'

        path.iterations++
        path.closed.add(current.id)
        path.current = current

        if (current.x === path.end.x && current.y === path.end.y) {
            return 'found'
        }

        for (const [dx, dy, stepCost] of NEIGHBOURS_8) {
            const nx = current.x + dx
            const ny = current.y + dy

            if (mesh.isBlocked(nx, ny)) continue

            // Disallow diagonal squeeze through two blocked orthogonal neighbours.
            if (dx !== 0 && dy !== 0) {
                if (mesh.isBlocked(current.x + dx, current.y) && mesh.isBlocked(current.x, current.y + dy)) continue
            }

            const nid = this.idOf(nx, ny)
            if (path.closed.has(nid)) continue

            const tentativeG = current.G + stepCost * mesh.cost(nx, ny)
            const knownG = path.bestG.get(nid)
            if (knownG !== undefined && tentativeG >= knownG) continue
            path.bestG.set(nid, tentativeG)

            const node = this.nodePool.obtain()
            node.setTo(
                nx,
                ny,
                nid,
                tentativeG,
                this.heuristic(nx, ny, path.end.x, path.end.y),
                current
            )
            path.open.enqueue(node)
        }

        return 'progress'
    }

}
