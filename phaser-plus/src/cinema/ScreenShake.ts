import type { Cameras } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

export type ShakeMode = 'random' | 'sine'

interface ShakeSource {
    trauma: number
    decay: number
    mode: ShakeMode
    frequency: number
    phase: number
    elapsed: number
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
        return this.push(trauma, decay, 'random', 0)
    }

    impact(trauma: number = 0.8): this {
        return this.push(trauma, 4, 'random', 0)
    }

    rumble(intensity: number, durationSec: number = 1): this {
        const decay = durationSec > 0 ? 1 / durationSec : 1
        return this.push(intensity, decay, 'random', 0)
    }

    sine(intensity: number, frequency: number = 12, durationSec: number = 1): this {
        const decay = durationSec > 0 ? 1 / durationSec : 1
        return this.push(intensity, decay, 'sine', frequency)
    }

    clear(): this {
        this.sources = []
        return this
    }

    private push(trauma: number, decay: number, mode: ShakeMode, frequency: number): this {
        if (trauma <= 0) return this
        this.sources.push({
            trauma: Math.min(trauma, 1),
            decay,
            mode,
            frequency,
            phase: Math.random() * Math.PI * 2,
            elapsed: 0
        })
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

        const survivors: ShakeSource[] = []
        let randomTotal = 0
        let sineX = 0
        let sineY = 0
        let sineRot = 0
        for (const source of this.sources) {
            source.trauma = Math.max(0, source.trauma - source.decay * dt)
            source.elapsed += dt
            if (source.trauma <= 0) continue
            survivors.push(source)
            const shake = Math.pow(source.trauma, this.exponent)
            if (source.mode === 'sine') {
                const omega = source.elapsed * Math.PI * 2 * source.frequency + source.phase
                sineX += Math.sin(omega) * this.maxOffset * shake
                sineY += Math.cos(omega) * this.maxOffset * shake
                sineRot += Math.sin(omega * 0.5) * this.maxAngle * shake
            } else {
                randomTotal += source.trauma
            }
        }
        this.sources = survivors

        if (survivors.length === 0) {
            this.appliedX = 0
            this.appliedY = 0
            this.appliedRotation = 0
            return
        }

        let randomX = 0
        let randomY = 0
        let randomRot = 0
        if (randomTotal > 0) {
            const trauma = Math.min(1, randomTotal)
            const shake = Math.pow(trauma, this.exponent)
            randomX = (Math.random() * 2 - 1) * this.maxOffset * shake
            randomY = (Math.random() * 2 - 1) * this.maxOffset * shake
            randomRot = (Math.random() * 2 - 1) * this.maxAngle * shake
        }

        this.appliedX = randomX + sineX
        this.appliedY = randomY + sineY
        this.appliedRotation = randomRot + sineRot

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
