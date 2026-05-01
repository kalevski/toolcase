import { ObjectPool } from '@toolcase/base'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'
import NavMesh from './NavMesh'
import Path from './Path'
import PathIterator from './PathIterator'
import PathNode from './PathNode'

interface Pendable { release(): void }

/**
 * Cooperative A* scheduler. Holds a `Path` pool, a shared `PathNode` pool, and
 * a FIFO of in-flight queries. Each `onUpdate` tick processes paths in
 * round-robin until `budgetMs` is exhausted or all queries terminate.
 */
export default class PathFinder extends Feature {

    /** Per-tick wall-clock budget in milliseconds. Default 2 ms. */
    budgetMs: number = 2

    private mesh: NavMesh | null = null

    private readonly nodePool: ObjectPool<PathNode> = new ObjectPool<PathNode>(PathNode, PathNode.reset)

    private readonly pathPool: ObjectPool<Path>

    private readonly iterator: PathIterator

    private readonly active: Path[] = []

    private readonly pendingFails: Array<{ path: Path, reason: string }> = []

    constructor(scene: Scene, key: string) {
        super(scene, key)
        this.iterator = new PathIterator(this.nodePool)
        this.pathPool = new ObjectPool<Path>(Path, this.resetPath)
    }

    setMesh(mesh: NavMesh): this {
        this.mesh = mesh
        return this
    }

    findPath(sx: number, sy: number, ex: number, ey: number, maxIterations: number = 5000): Path {
        if (this.mesh === null) {
            throw new Error('PathFinder: setMesh(navMesh) required before findPath()')
        }
        const path = this.pathPool.obtain()
        path.setTo(sx, sy, ex, ey)
        path.maxIterations = maxIterations

        if (this.mesh.isBlocked(ex, ey)) {
            this.pendingFails.push({ path, reason: 'end_blocked' })
            return path
        }

        this.iterator.seed(path)
        this.active.push(path)
        return path
    }

    override onUpdate(_time: number, _delta: number): void {
        if (this.mesh === null) return

        while (this.pendingFails.length > 0) {
            const fail = this.pendingFails.shift()!
            fail.path.markFailed(fail.reason)
            this.releasePath(fail.path)
        }

        if (this.active.length === 0) return

        const start = performance.now()
        const safetyLimit = this.active.length * 256
        let safety = 0

        while (this.active.length > 0 && performance.now() - start < this.budgetMs && safety < safetyLimit) {
            const path = this.active.shift()!
            const status = this.iterator.step(path, this.mesh)
            safety++

            if (status === 'progress') {
                this.active.push(path)
                continue
            }

            if (status === 'found') {
                path.markFound()
            } else {
                path.markFailed('exhausted')
            }
            this.releasePath(path)
        }
    }

    override onDestroy(): void {
        this.active.length = 0
        this.pendingFails.length = 0
        this.nodePool.dispose()
        this.pathPool.dispose()
    }

    private releasePath(path: Path): void {
        (path as unknown as Pendable).release()
    }

    private resetPath = (path: Path): void => {
        while (path.open.length > 0) {
            const node = path.open.pop()
            if (node !== null) (node as unknown as Pendable).release()
        }
        path.closed.clear()
        path.bestG.clear()
        path.current = null
        path.iterations = 0
        path.removeAllListeners()
    }

}
