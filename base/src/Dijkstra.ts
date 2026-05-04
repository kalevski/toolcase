import EventEmitter from './EventEmitter'
import PriorityQueue from './PriorityQueue'

export type Neighbors<N> = (node: N) => Iterable<N>
export type EdgeCost<N> = (from: N, to: N) => number
export type NodeHash<N> = (node: N) => string

export interface DijkstraOptions<N> {
    neighbors: Neighbors<N>
    cost: EdgeCost<N>
    hash?: NodeHash<N>
}

export interface PathResult<N> {
    path: N[]
    cost: number
}

export type SearchStatus = 'searching' | 'found' | 'failed'

export type FailReason = 'exhausted' | 'max_iterations'

interface FrontierEntry {
    key: string
    g: number
    priority: number
}

const defaultHash = <N>(node: N): string => String(node)

class Dijkstra<N> extends EventEmitter {

    static readonly FOUND = 'found'

    static readonly FAILED = 'failed'

    static readonly VISIT = 'visit'

    static readonly OPEN = 'open'

    readonly start: N

    readonly end: N

    iterations: number = 0

    maxIterations: number = Infinity

    protected status: SearchStatus = 'searching'

    protected hash: NodeHash<N>

    protected endKey: string

    protected options: DijkstraOptions<N>

    protected distances: Map<string, number> = new Map()

    protected previousKey: Map<string, string> = new Map()

    protected nodeMap: Map<string, N> = new Map()

    protected frontier: PriorityQueue<FrontierEntry>

    private seeded: boolean = false

    constructor(start: N, end: N, options: DijkstraOptions<N>) {
        super()
        if (typeof options?.neighbors !== 'function') {
            throw new Error('neighbors is required')
        }
        if (typeof options?.cost !== 'function') {
            throw new Error('cost is required')
        }
        this.start = start
        this.end = end
        this.options = options
        this.hash = typeof options.hash === 'function' ? options.hash : defaultHash
        this.endKey = this.hash(end)
        this.frontier = new PriorityQueue<FrontierEntry>(entry => entry.priority)
    }

    static find<N>(start: N, end: N, options: DijkstraOptions<N>): PathResult<N> | null {
        const search = new Dijkstra(start, end, options)
        return search.run()
    }

    get isComplete(): boolean {
        return this.status !== 'searching'
    }

    getStatus(): SearchStatus {
        return this.status
    }

    getResult(): PathResult<N> | null {
        if (this.status !== 'found') return null
        return this.reconstruct()
    }

    step(): SearchStatus {
        if (this.status !== 'searching') return this.status
        if (!this.seeded) {
            this.seed()
            this.seeded = true
        }
        if (this.iterations >= this.maxIterations) {
            return this.fail('max_iterations')
        }
        const current = this.frontier.dequeue()
        if (current === null) {
            return this.fail('exhausted')
        }
        const known = this.distances.get(current.key)!
        if (current.g > known) {
            return this.status
        }
        this.iterations++
        const node = this.nodeMap.get(current.key)!
        this.emit(Dijkstra.VISIT, node, current.g)
        if (current.key === this.endKey) {
            this.status = 'found'
            const result = this.reconstruct()
            this.emit(Dijkstra.FOUND, result)
            return 'found'
        }
        for (const neighbor of this.options.neighbors(node)) {
            this.relax(current.key, node, neighbor, current.g)
        }
        return 'searching'
    }

    run(maxSteps: number = Infinity): PathResult<N> | null {
        let count = 0
        while (this.status === 'searching' && count < maxSteps) {
            this.step()
            count++
        }
        return this.getResult()
    }

    protected relax(currentKey: string, node: N, neighbor: N, currentG: number): void {
        const stepCost = this.options.cost(node, neighbor)
        if (!Number.isFinite(stepCost) || stepCost < 0) {
            throw new Error('cost must be a non-negative finite number')
        }
        const neighborKey = this.hash(neighbor)
        const nextG = currentG + stepCost
        const previousG = this.distances.get(neighborKey)
        if (previousG !== undefined && nextG >= previousG) return
        this.distances.set(neighborKey, nextG)
        this.previousKey.set(neighborKey, currentKey)
        this.nodeMap.set(neighborKey, neighbor)
        this.frontier.enqueue({ key: neighborKey, g: nextG, priority: this.priorityOf(neighbor, nextG) })
        this.emit(Dijkstra.OPEN, neighbor, nextG)
    }

    protected priorityOf(_neighbor: N, gCost: number): number {
        return gCost
    }

    protected seed(): void {
        const key = this.hash(this.start)
        this.distances.set(key, 0)
        this.nodeMap.set(key, this.start)
        this.frontier.enqueue({ key, g: 0, priority: this.priorityOf(this.start, 0) })
    }

    protected reconstruct(): PathResult<N> {
        const path: N[] = []
        let key: string | undefined = this.endKey
        while (key !== undefined) {
            path.unshift(this.nodeMap.get(key)!)
            key = this.previousKey.get(key)
        }
        return { path, cost: this.distances.get(this.endKey)! }
    }

    protected fail(reason: FailReason): SearchStatus {
        this.status = 'failed'
        this.emit(Dijkstra.FAILED, reason)
        return 'failed'
    }

}

export default Dijkstra
