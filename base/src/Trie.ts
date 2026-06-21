type TrieNode = {
    children: Map<string, TrieNode>
    terminal: boolean
}

class Trie {

    private root: TrieNode = { children: new Map(), terminal: false }

    private _size: number = 0

    get size(): number {
        return this._size
    }

    insert(word: string): this {
        let node = this.root
        for (const ch of word) {
            let next = node.children.get(ch)
            if (!next) {
                next = { children: new Map(), terminal: false }
                node.children.set(ch, next)
            }
            node = next
        }
        if (!node.terminal) {
            node.terminal = true
            this._size++
        }
        return this
    }

    has(word: string): boolean {
        let node = this.root
        for (const ch of word) {
            const next = node.children.get(ch)
            if (!next) return false
            node = next
        }
        return node.terminal
    }

    delete(word: string): boolean {
        const path: Array<[TrieNode, string]> = []
        let node = this.root
        for (const ch of word) {
            const child = node.children.get(ch)
            if (!child) return false
            path.push([node, ch])
            node = child
        }
        if (!node.terminal) return false
        node.terminal = false
        this._size--
        for (let i = path.length - 1; i >= 0; i--) {
            const [parent, ch] = path[i]
            const child = parent.children.get(ch) as TrieNode
            if (child.children.size === 0 && !child.terminal) {
                parent.children.delete(ch)
            } else {
                break
            }
        }
        return true
    }

    startsWith(prefix: string): string[] {
        let node = this.root
        for (const ch of prefix) {
            const next = node.children.get(ch)
            if (!next) return []
            node = next
        }
        const results: string[] = []
        this.collect(node, prefix, results)
        return results
    }

    private collect(node: TrieNode, prefix: string, results: string[]): void {
        if (node.terminal) results.push(prefix)
        for (const [ch, child] of node.children) {
            this.collect(child, prefix + ch, results)
        }
    }

    clear(): this {
        this.root = { children: new Map(), terminal: false }
        this._size = 0
        return this
    }

}

export default Trie
