/**
 * A single A* search node. Pooled by `PathFinder`; never instantiate manually.
 * `id` is `${x}|${y}` so it survives negative coords and avoids stride math.
 */
export default class PathNode {

    x: number = 0

    y: number = 0

    id: string = ''

    parent: PathNode | null = null

    G: number = 0

    H: number = 0

    F: number = 0

    setTo(x: number, y: number, id: string, G: number, H: number, parent: PathNode | null): this {
        this.x = x
        this.y = y
        this.id = id
        this.G = G
        this.H = H
        this.F = G + H
        this.parent = parent
        return this
    }

    static reset(node: PathNode): void {
        node.x = 0
        node.y = 0
        node.id = ''
        node.parent = null
        node.G = 0
        node.H = 0
        node.F = 0
    }

}
