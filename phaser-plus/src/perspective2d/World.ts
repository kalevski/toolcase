import type Scene from '../engine/Scene'
import Layer from '../features/Layer'
import Matrix2 from '../math/Matrix2'
import GameObject2D from './GameObject2D'
import DepthSort from './DepthSort'
import Grid from './Grid'

export interface GridColors {
    background?: number
    lines?: number
}

type GameObject2DClass<T extends GameObject2D> = new (scene: Scene, world: World) => T

export default class World extends Layer {

    private grid!: Grid

    private gridUpdate: boolean | null = null

    private readonly _projection: Matrix2 = Matrix2.create(50, 50)

    sort: DepthSort = new DepthSort()

    override onCreate(): void {
        this.grid = new Grid(this.scene, 0, 0)
        this.grid.depth = -Number.MAX_SAFE_INTEGER
        ;(this.scene.add as any).existing(this.grid)
        this.grid.onCreate()
        this.grid.setScrollFactor(0)
        this.grid.setVisible(false)

        super.onCreate()
        this.onLayerUpdate()
    }

    protected override onLayerUpdate(): void {
        super.onLayerUpdate()
        this.grid.cameraFilter = this.container.cameraFilter
        this.grid.move(this.camera)

        if (this.gridUpdate !== null) {
            this.grid.setVisible(this.gridUpdate)
            if (this.gridUpdate) {
                this.grid.setProjection(this._projection)
            }
            this.gridUpdate = null
        }
        ;(this.container.list as unknown as GameObject2D[]).sort(this.sort.fn)

        const matter = (this.scene as any).matter
        if (matter !== undefined && matter.world.debugGraphic !== undefined) {
            matter.world.debugGraphic.cameraFilter = this.container.cameraFilter
        }
    }

    override onDestroy(): void {
        super.onDestroy()
    }

    debug(flag: boolean = true, colors: GridColors = {}): this {
        if (typeof colors === 'object' && colors.background !== undefined && colors.lines !== undefined) {
            this.grid.setColors(colors.background, colors.lines)
        }
        if (typeof flag !== 'boolean') return this
        this.gridUpdate = null
        if (this.grid.visible === flag) return this
        this.gridUpdate = flag
        return this
    }

    set projection(matrix: Matrix2) {
        this._projection.setValues(matrix.v00, matrix.v01, matrix.v10, matrix.v11)
        this.sort.setup()
        ;(this.list as unknown as GameObject2D[]).forEach(object => {
            object.setTransform(object.transform.x, object.transform.y)
        })
        if (this.grid.visible) {
            this.gridUpdate = true
        }
    }

    get projection(): Matrix2 {
        return this._projection
    }

    register<T extends GameObject2D>(key: string, gameObjectClass: GameObject2DClass<T>): this {
        this.scene.pool.register(key, gameObjectClass as any, this.createInstanceFn as any)
        return this
    }

    add<T extends GameObject2D>(key: string, x: number, y: number): T | null {
        const object = this.scene.pool.obtain<T>(key)
        if (object === null) return null
        this.container.add(object as any)
        object.setTransform(x, y)
        return object
    }

    remove<T extends GameObject2D>(gameObject: T): this {
        this.container.remove(gameObject as any)
        this.scene.pool.release(gameObject)
        return this
    }

    /**
     * Release every child back to the pool.
     */
    override clear(): this {
        const children = this.container.list.slice() as unknown as GameObject2D[]
        for (const child of children) {
            this.remove(child)
        }
        return this
    }

    private createInstanceFn = (_key: string, gameObjectClass: GameObject2DClass<GameObject2D>, scene: Scene): GameObject2D => {
        return new gameObjectClass(scene, this)
    }

}
