import type { Cameras } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

interface ShakeSource {
    trauma: number
    decay: number
}

type CameraWithRotation = Cameras.Scene2D.Camera & { rotation: number }

export default class ScreenShake extends Feature {

    private sources: ShakeSource[] = []

    private camera: CameraWithRotation | null = null

    private maxOffset: number = 16

    private maxAngle: number = 0.05

    private exponent: number = 2

    private appliedX: number = 0

    private appliedY: number = 0

    private appliedRotation: number = 0

    private bound: boolean = false

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setCamera(camera: Cameras.Scene2D.Camera): this {
        this.camera = camera as CameraWithRotation
        this.bound = true
        return this
    }

    setMaxOffset(value: number): this {
        this.maxOffset = value
        return this
    }

    setMaxAngle(value: number): this {
        this.maxAngle = value
        return this
    }

    setExponent(value: number): this {
        this.exponent = value
        return this
    }

    add(trauma: number, decay: number = 1): this {
        if (trauma <= 0) return this
        this.sources.push({ trauma: Math.min(trauma, 1), decay })
        return this
    }

    clear(): this {
        this.sources = []
        return this
    }

    override onCreate(): void {
        if (!this.bound) {
            this.camera = this.scene.cameras.main as CameraWithRotation
        }
    }

    override onUpdate(_time: number, delta: number): void {
        const camera = this.camera
        if (camera === null) return
        const dt = delta / 1000

        camera.scrollX -= this.appliedX
        camera.scrollY -= this.appliedY
        camera.rotation -= this.appliedRotation

        let total = 0
        const survivors: ShakeSource[] = []
        for (const source of this.sources) {
            source.trauma = Math.max(0, source.trauma - source.decay * dt)
            if (source.trauma > 0) {
                survivors.push(source)
                total += source.trauma
            }
        }
        this.sources = survivors

        if (total <= 0) {
            this.appliedX = 0
            this.appliedY = 0
            this.appliedRotation = 0
            return
        }

        const trauma = Math.min(1, total)
        const shake = Math.pow(trauma, this.exponent)
        this.appliedX = (Math.random() * 2 - 1) * this.maxOffset * shake
        this.appliedY = (Math.random() * 2 - 1) * this.maxOffset * shake
        this.appliedRotation = (Math.random() * 2 - 1) * this.maxAngle * shake

        camera.scrollX += this.appliedX
        camera.scrollY += this.appliedY
        camera.rotation += this.appliedRotation
    }

    override onDestroy(): void {
        this.sources = []
        if (this.camera !== null) {
            this.camera.scrollX -= this.appliedX
            this.camera.scrollY -= this.appliedY
            this.camera.rotation -= this.appliedRotation
        }
        this.camera = null
    }

}
