import { AStar, Dijkstra } from '@toolcase/base'
import type { PathResult } from '@toolcase/base'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'
import NavMesh from './NavMesh'
import Path, { type GridNode } from './Path'

const STRAIGHT = 1

const DIAG = Math.SQRT2

const NEIGHBOURS_8: ReadonlyArray<readonly [number, number]> = [
    [ 1,  0],
    [-1,  0],
    [ 0,  1],
    [ 0, -1],
    [ 1,  1],
    [ 1, -1],
    [-1,  1],
    [-1, -1]
]

const hashNode = (node: GridNode): string => `${node.x}|${node.y}`

const octileHeuristic = (from: GridNode, to: GridNode): number => {
    const dx = Math.abs(from.x - to.x)
    const dy = Math.abs(from.y - to.y)
    return STRAIGHT * (dx + dy) + (DIAG - 2 * STRAIGHT) * Math.min(dx, dy)
}

const buildNeighbors = (mesh: NavMesh) => function* (node: GridNode): Iterable<GridNode> {
    for (const [dx, dy] of NEIGHBOURS_8) {
        const nx = node.x + dx
        const ny = node.y + dy
        if (mesh.isBlocked(nx, ny)) continue
        // Disallow diagonal squeeze through two blocked orthogonal neighbours.
        if (dx !== 0 && dy !== 0) {
            if (mesh.isBlocked(node.x + dx, node.y) && mesh.isBlocked(node.x, node.y + dy)) continue
        }
        yield { x: nx, y: ny }
    }
}

const buildEdgeCost = (mesh: NavMesh) => (from: GridNode, to: GridNode): number => {
    const dx = Math.abs(to.x - from.x)
    const dy = Math.abs(to.y - from.y)
    const stepCost = (dx !== 0 && dy !== 0) ? DIAG : STRAIGHT
    // Clamp to ≥ 1 so the octile heuristic (which assumes min step cost = 1) stays admissible.
    // A mesh.cost() below 1 would let the heuristic over-estimate and produce non-optimal paths.
    return stepCost * Math.max(1, mesh.cost(to.x, to.y))
}

/**
 * Cooperative A* scheduler. Holds a FIFO of in-flight queries and spends up to
 * `budgetMs` per `onUpdate` tick stepping each one. Each query owns an
 * `@toolcase/base` `AStar` instance whose `step()` is invoked round-robin until
 * the path resolves or the budget runs out.
 *
 * ## `PATH_FAILED` reason strings
 * | Reason | Source |
 * |---|---|
 * | `'end_blocked'` | The destination tile is not navigable (`mesh.isBlocked`). |
 * | `'error'` | The `cost()`/heuristic threw during a search step. |
 * | `'exhausted'` | The frontier was fully explored without reaching the goal (unreachable). |
 * | `'max_iterations'` | The per-query `maxIterations` cap was hit before the goal was found. |
 *
 * **Note on `maxIterations`:** The default of 5 000 is intentionally conservative.
 * On an 8-connected grid the frontier expands roughly as a circle, so a 100×100
 * grid can already exhaust the budget for long diagonal paths. Callers that need
 * large maps should raise the cap via `findPath(…, maxIterations)`. Because both
 * `'exhausted'` and `'max_iterations'` can mean "no path exists", they are
 * indistinguishable from the caller's perspective — both should be treated as
 * a permanent failure.
 */
export default class PathFinder extends Feature {

    /** Per-tick wall-clock budget in milliseconds. */
    budgetMs: number = 0.1

    private mesh: NavMesh | null = null

    private readonly active: Path[] = []

    private readonly pendingFails: Array<{ path: Path, reason: string }> = []

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setMesh(mesh: NavMesh): this {
        this.mesh = mesh
        return this
    }

    findPath(sx: number, sy: number, ex: number, ey: number, maxIterations: number = 5000): Path {
        if (this.mesh === null) {
            throw new Error('PathFinder: setMesh(navMesh) required before findPath()')
        }
        const path = new Path()
        path.setTo(sx, sy, ex, ey)
        path.maxIterations = maxIterations

        if (this.mesh.isBlocked(ex, ey)) {
            this.pendingFails.push({ path, reason: 'end_blocked' })
            return path
        }

        const search = new AStar<GridNode>(
            { x: sx, y: sy },
            { x: ex, y: ey },
            {
                hash: hashNode,
                heuristic: octileHeuristic,
                neighbors: buildNeighbors(this.mesh),
                cost: buildEdgeCost(this.mesh)
            }
        )
        search.maxIterations = maxIterations
        search.on(Dijkstra.FOUND, (result: PathResult<GridNode>) => path.markFound(result))
        search.on(Dijkstra.FAILED, (reason: string) => path.markFailed(reason))

        path.search = search
        path.markSearching()
        this.active.push(path)
        return path
    }

    override onUpdate(_time: number, _delta: number): void {
        while (this.pendingFails.length > 0) {
            const fail = this.pendingFails.shift()!
            fail.path.markFailed(fail.reason)
        }

        if (this.active.length === 0) return

        const start = performance.now()
        const safetyLimit = this.active.length * 256
        let safety = 0

        while (this.active.length > 0 && performance.now() - start < this.budgetMs && safety < safetyLimit) {
            const path = this.active.shift()!
            const search = path.search!
            try {
                search.step()
            } catch {
                path.markFailed('error')
                continue
            }
            safety++

            if (search.isComplete) continue
            this.active.push(path)
        }
    }

    override onDestroy(): void {
        this.active.length = 0
        this.pendingFails.length = 0
    }

}
