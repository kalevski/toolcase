import type { Tilemaps } from 'phaser'
import NavMesh from './NavMesh'

export default class TilemapNavMesh extends NavMesh {

    private readonly map: Tilemaps.Tilemap
    private readonly layerRef: number | string | undefined
    private readonly walkableSet: ReadonlySet<number>

    constructor(map: Tilemaps.Tilemap, walkable: number[], layer?: number | string) {
        super()
        this.map = map
        this.layerRef = layer
        this.walkableSet = new Set(walkable)
    }

    override isBlocked(x: number, y: number): boolean {
        const tile = this.layerRef !== undefined
            ? this.map.getTileAt(x, y, false, this.layerRef)
            : this.map.getTileAt(x, y, false)
        if (tile === null) return true
        if (tile.index === -1) return true
        return !this.walkableSet.has(tile.index)
    }

    override cost(x: number, y: number): number {
        const tile = this.layerRef !== undefined
            ? this.map.getTileAt(x, y, false, this.layerRef)
            : this.map.getTileAt(x, y, false)
        const props = tile?.properties as Record<string, unknown> | undefined
        const c = props?.cost
        return typeof c === 'number' && c > 0 ? c : 1
    }

}
