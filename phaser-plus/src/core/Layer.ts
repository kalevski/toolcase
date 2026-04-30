import { generateId } from '@toolcase/base'
import type { Cameras, GameObjects, Time, Types } from 'phaser'
import { LAYER_DEPTH_UPDATE } from './Events'
import Feature from './Feature'
import GameObject from './GameObject'

type ColorInput = string | number | Types.Display.InputColorObject

export default class Layer extends Feature {

    private readonly CAMERA_NAME: string = generateId(16)

    container!: GameObject

    private layerLoop!: Time.TimerEvent

    onCreate(): void {
        if (this.scene.cameras.main.name === '') {
            this.scene.cameras.main.setName(this.CAMERA_NAME)
        } else {
            const { width, height } = this.game.config
            this.scene.cameras.add(0, 0, width as number, height as number, false, this.CAMERA_NAME)
        }

        this.camera.centerOn(0, 0)

        this.container = new GameObject(this.scene, 0, 0)
        ;(this.scene.add as any).existing(this.container)

        this.layerLoop = this.scene.time.addEvent({
            delay: 100,
            callback: this.onLayerUpdate,
            callbackScope: this,
            loop: true
        })
        this.onLayerUpdate()
    }

    set visible(value: boolean) {
        this.container.setVisible(value)
    }

    get visible(): boolean {
        return this.container.visible
    }

    set depth(value: number) {
        ;(this.camera as any).depth = value
        this.container.setDepth(value)
        this.emit(LAYER_DEPTH_UPDATE)
    }

    get depth(): number {
        return (this.camera as any).depth || 0
    }

    protected onLayerUpdate(): void {
        this.container.cameraFilter = this.cameraFilter
    }

    onDestroy(): void {
        this.container.destroy()
        this.layerLoop.remove()
        this.layerLoop.destroy()
        const cam = this.camera
        if (cam === null) return
        if (cam.id === this.scene.cameras.main.id) {
            cam.setName('')
        } else {
            this.scene.cameras.remove(cam)
        }
    }

    get camera(): Cameras.Scene2D.Camera {
        return this.scene.cameras.getCamera(this.CAMERA_NAME) as Cameras.Scene2D.Camera
    }

    get cameraFilter(): number {
        const id = this.camera.id
        let filter = 0
        for (const camera of this.scene.cameras.cameras) {
            if (camera.id === id) continue
            filter |= camera.id
        }
        return filter
    }

    get list(): GameObjects.GameObject[] {
        return this.container.list as GameObjects.GameObject[]
    }

    get count(): number {
        return this.container.list.length
    }

    getByName<T extends GameObjects.GameObject>(name: string): T {
        return this.container.getByName(name) as T
    }

    /**
     * Remove all children from the layer (without destroying them).
     * Subclasses may override to release back to a pool.
     */
    clear(): this {
        this.container.removeAll(false)
        return this
    }

    setBackgroundColor(color: ColorInput): this {
        this.camera.setBackgroundColor(color)
        return this
    }

    centerOn(x: number, y: number): this {
        this.camera.centerOn(x, y)
        return this
    }

}
