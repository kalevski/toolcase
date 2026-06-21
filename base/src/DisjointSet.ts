class DisjointSet {

    private parent: Map<string, string> = new Map()

    private rank: Map<string, number> = new Map()

    private _count: number = 0

    get count(): number {
        return this._count
    }

    makeSet(id: string): this {
        if (!this.parent.has(id)) {
            this.parent.set(id, id)
            this.rank.set(id, 0)
            this._count++
        }
        return this
    }

    find(id: string): string | null {
        if (!this.parent.has(id)) {
            return null
        }
        let root = id
        while (this.parent.get(root) !== root) {
            root = this.parent.get(root) as string
        }
        let current = id
        while (current !== root) {
            const next = this.parent.get(current) as string
            this.parent.set(current, root)
            current = next
        }
        return root
    }

    union(a: string, b: string): boolean {
        const rootA = this.find(a)
        const rootB = this.find(b)
        if (rootA === null || rootB === null) {
            return false
        }
        if (rootA === rootB) {
            return false
        }
        const rankA = this.rank.get(rootA) as number
        const rankB = this.rank.get(rootB) as number
        if (rankA < rankB) {
            this.parent.set(rootA, rootB)
        } else if (rankA > rankB) {
            this.parent.set(rootB, rootA)
        } else {
            this.parent.set(rootB, rootA)
            this.rank.set(rootA, rankA + 1)
        }
        this._count--
        return true
    }

    connected(a: string, b: string): boolean {
        const rootA = this.find(a)
        const rootB = this.find(b)
        if (rootA === null || rootB === null) {
            return false
        }
        return rootA === rootB
    }

}

export default DisjointSet
