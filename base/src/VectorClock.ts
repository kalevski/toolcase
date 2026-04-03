class VectorClock {

    readonly nodeId: string

    private data: Record<string, number> = {}

    constructor(nodeId: string, data: Record<string, number> = {}) {
        this.nodeId = nodeId
        this.data = data
    }

    setClock(clock: Record<string, number> = {}): void {
        this.data = clock
    }

    getClock(): Record<string, number> {
        return { ...this.data }
    }

    setVersion(version: number, nodeId: string = this.nodeId): void {
        this.data[nodeId] = version
    }

    getVersion(nodeId: string = this.nodeId): number {
        return this.data[nodeId] || 0
    }

    increment(): void {
        this.data[this.nodeId] = this.getVersion(this.nodeId) + 1
    }

    update(vectorClock: VectorClock): void {
        const updated: Record<string, number> = {}
        for (const nodeId of VectorClock.getNodeIds(this, vectorClock)) {
            updated[nodeId] = Math.max(this.getVersion(nodeId), vectorClock.getVersion(nodeId))
        }
        this.data = updated
    }

    isAfter(vectorClock: VectorClock): boolean {
        return VectorClock.isAfter(this, vectorClock)
    }

    isConcurrent(vectorClock: VectorClock): boolean {
        return VectorClock.isConcurrent(this, vectorClock)
    }

    isBefore(vectorClock: VectorClock): boolean {
        return VectorClock.isBefore(this, vectorClock)
    }

    static getNodeIds(vectorClock1: VectorClock, vectorClock2: VectorClock): string[] {
        const map = { ...vectorClock1.getClock(), ...vectorClock2.getClock() }
        return Object.keys(map)
    }

    static isAfter(vectorClock1: VectorClock, vectorClock2: VectorClock): boolean {
        let isAfter = true
        for (const nodeId of VectorClock.getNodeIds(vectorClock1, vectorClock2)) {
            if (vectorClock1.getVersion(nodeId) < vectorClock2.getVersion(nodeId)) {
                isAfter = false
            }
        }
        return isAfter
    }

    static isConcurrent(vectorClock1: VectorClock, vectorClock2: VectorClock): boolean {
        return !(VectorClock.isAfter(vectorClock1, vectorClock2) || VectorClock.isAfter(vectorClock2, vectorClock1))
    }

    static isBefore(vectorClock1: VectorClock, vectorClock2: VectorClock): boolean {
        return !VectorClock.isAfter(vectorClock1, vectorClock2) && !VectorClock.isConcurrent(vectorClock1, vectorClock2)
    }

    static compare(vectorClock1: VectorClock, vectorClock2: VectorClock): number {
        if (VectorClock.isAfter(vectorClock1, vectorClock2)) {
            return 1
        } else if (VectorClock.isConcurrent(vectorClock1, vectorClock2)) {
            return 0
        } else {
            return -1
        }
    }
}

export default VectorClock
