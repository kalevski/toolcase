import type { Tilemaps } from 'phaser'
import type Scene from '../engine/Scene'
import Feature from '../features/Feature'
import ObjectLayer from '../features/ObjectLayer'
import TilemapNavMesh from '../ai/TilemapNavMesh'

export interface BuildNavMeshOptions {
    walkable: number[]
    layer?: number | string
}

export interface TilemapObject {
    name: string
    type: string
    x: number
    y: number
    width: number
    height: number
    properties: Record<string, unknown>
}

class TilemapFeature extends Feature {

    private activeMap: Tilemaps.Tilemap | null = null

    private readonly tilesets: Map<string, Tilemaps.Tileset> = new Map()

    private readonly layers: Map<string, Tilemaps.TilemapLayer> = new Map()

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    loadTiled(key: string, url: string): this {
        this.scene.load.tilemapTiledJSON(key, url)
        return this
    }

    loadLDtk(key: string, url: string): this {
        this.scene.load.json(key, url)
        return this
    }

    create(key: string): this {
        this.activeMap?.destroy()
        this.tilesets.clear()
        this.layers.clear()
        this.activeMap = this.scene.make.tilemap({ key })
        return this
    }

    createFromData(data: number[][], tileWidth: number, tileHeight: number): this {
        this.activeMap?.destroy()
        this.tilesets.clear()
        this.layers.clear()
        this.activeMap = this.scene.make.tilemap({ data, tileWidth, tileHeight })
        return this
    }

    addTileset(tilesetName: string, textureKey: string): Tilemaps.Tileset {
        if (this.activeMap === null) throw new Error('TilemapFeature: call create() or createFromData() first')
        const ts = this.activeMap.addTilesetImage(tilesetName, textureKey)
        if (ts === null) throw new Error(`TilemapFeature: tileset "${tilesetName}" not found in map data`)
        this.tilesets.set(tilesetName, ts)
        return ts
    }

    createLayer(layerName: string | number, tilesetName?: string): Tilemaps.TilemapLayer {
        if (this.activeMap === null) throw new Error('TilemapFeature: call create() or createFromData() first')
        const tileset = tilesetName !== undefined ? (this.tilesets.get(tilesetName) ?? []) : []
        const layer = this.activeMap.createLayer(layerName, tileset as any, 0, 0)
        if (layer === null) throw new Error(`TilemapFeature: layer "${layerName}" not found`)
        if (typeof layerName === 'string') this.layers.set(layerName, layer)
        return layer
    }

    buildColliders(layerName: string | number, tilesetName?: string): Tilemaps.TilemapLayer {
        const layer = this.createLayer(layerName, tilesetName)
        layer.setCollisionByProperty({ collides: true })
        return layer
    }

    buildNavMesh(options: BuildNavMeshOptions): TilemapNavMesh {
        if (this.activeMap === null) throw new Error('TilemapFeature: call create() or createFromData() first')
        return new TilemapNavMesh(this.activeMap, options.walkable, options.layer)
    }

    toObjectLayer(featureKey: string, objectLayerName: string, poolKey: string): ObjectLayer {
        if (this.activeMap === null) throw new Error('TilemapFeature: call create() or createFromData() first')
        const layer = this.scene.features.register(featureKey, ObjectLayer)
        const objLayer = this.activeMap.getObjectLayer(objectLayerName)
        if (objLayer !== null) {
            for (const obj of objLayer.objects) {
                if (obj.x !== undefined && obj.y !== undefined) {
                    layer.add(poolKey, obj.x, obj.y)
                }
            }
        }
        return layer
    }

    getObjects(objectLayerName: string): TilemapObject[] {
        if (this.activeMap === null) throw new Error('TilemapFeature: call create() or createFromData() first')
        const objLayer = this.activeMap.getObjectLayer(objectLayerName)
        if (objLayer === null) return []
        return objLayer.objects.map(o => ({
            name: o.name ?? '',
            type: (o as any).type ?? '',
            x: o.x ?? 0,
            y: o.y ?? 0,
            width: o.width ?? 0,
            height: o.height ?? 0,
            properties: (o.properties as Record<string, unknown>) ?? {}
        }))
    }

    get tilemap(): Tilemaps.Tilemap | null {
        return this.activeMap
    }

    override onDestroy(): void {
        this.activeMap?.destroy()
        this.activeMap = null
        this.tilesets.clear()
        this.layers.clear()
    }

}

export default TilemapFeature
