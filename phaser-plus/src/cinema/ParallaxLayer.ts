import type { Cameras, GameObjects } from 'phaser'
import Layer from '../features/Layer'

export default class ParallaxLayer extends Layer {

    private factorX: number = 1

    private factorY: number = 1

    private referenceCamera: Cameras.Scene2D.Camera | null = null

    private autoTile: boolean = false

    private tileWidth: number = 0

    private tileHeight: number = 0

    private tiledChildren: GameObjects.GameObject[] = []

    setFactor(x: number, y: number = x): this {
        this.factorX = x
        this.factorY = y
        return this
    }

    setReference(camera: Cameras.Scene2D.Camera): this {
        this.referenceCamera = camera
        return this
    }

    setAutoTile(width: number, height: number, flag: boolean = true): this {
        this.autoTile = flag
        this.tileWidth = width
        this.tileHeight = height
        return this
    }

    addTiled(child: GameObjects.GameObject): this {
        this.tiledChildren.push(child)
        this.container.add(child)
        return this
    }

    override onCreate(): void {
        super.onCreate()
        this.referenceCamera = this.scene.cameras.main
    }

    override onUpdate(time: number, delta: number): void {
        super.onUpdate(time, delta)
        const ref = this.referenceCamera
        if (ref === null) return
        const own = this.camera
        own.scrollX = ref.scrollX * this.factorX
        own.scrollY = ref.scrollY * this.factorY

        if (this.autoTile && this.tileWidth > 0 && this.tileHeight > 0) {
            this.repositionTiles(own.scrollX, own.scrollY)
        }
    }

    private repositionTiles(scrollX: number, scrollY: number): void {
        for (const child of this.tiledChildren) {
            const c = child as GameObjects.GameObject & { x: number, y: number }
            const baseX = Math.floor(scrollX / this.tileWidth) * this.tileWidth
            const baseY = Math.floor(scrollY / this.tileHeight) * this.tileHeight
            c.x = baseX + (((c.x - baseX) % this.tileWidth) + this.tileWidth) % this.tileWidth
            c.y = baseY + (((c.y - baseY) % this.tileHeight) + this.tileHeight) % this.tileHeight
        }
    }

}
