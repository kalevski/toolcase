import type { GameObjects } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

interface Flash {
    color: number
    duration: number
    holdSec: number
    elapsed: number
}

export default class CameraFlash extends Feature {

    private overlay: GameObjects.Rectangle | null = null

    private flashes: Flash[] = []

    private depth: number = 1100

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setDepth(depth: number): this {
        this.depth = depth
        this.overlay?.setDepth(depth)
        return this
    }

    flash(color: number = 0xffffff, durationSec: number = 0.3, holdSec: number = 0): this {
        if (durationSec <= 0 && holdSec <= 0) return this
        this.flashes.push({ color, duration: Math.max(0, durationSec), holdSec: Math.max(0, holdSec), elapsed: 0 })
        return this
    }

    clear(): this {
        this.flashes = []
        if (this.overlay !== null) {
            this.overlay.setAlpha(0)
            this.overlay.setVisible(false)
        }
        return this
    }

    override onCreate(): void {
        const { width, height } = this.scene.scale
        const overlay = this.scene.add.rectangle(0, 0, width, height, 0xffffff)
        overlay.setOrigin(0, 0)
        overlay.setScrollFactor(0)
        overlay.setDepth(this.depth)
        overlay.setAlpha(0)
        overlay.setVisible(false)
        this.overlay = overlay
        this.scene.scale.on('resize', this.resize, this)
    }

    private resize(): void {
        if (this.overlay === null) return
        const { width, height } = this.scene.scale
        this.overlay.setSize(width, height)
    }

    override onUpdate(_time: number, delta: number): void {
        const overlay = this.overlay
        if (overlay === null) return
        if (this.flashes.length === 0) {
            if (overlay.alpha !== 0) {
                overlay.setAlpha(0)
                overlay.setVisible(false)
            }
            return
        }

        const dt = delta / 1000
        let totalAlpha = 0
        let weightedR = 0
        let weightedG = 0
        let weightedB = 0
        const survivors: Flash[] = []
        for (const fx of this.flashes) {
            fx.elapsed += dt
            const total = fx.holdSec + fx.duration
            if (fx.elapsed >= total) continue
            survivors.push(fx)
            const alpha = fx.elapsed < fx.holdSec
                ? 1
                : Math.max(0, 1 - (fx.elapsed - fx.holdSec) / Math.max(0.0001, fx.duration))
            const r = (fx.color >> 16) & 0xff
            const g = (fx.color >> 8) & 0xff
            const b = fx.color & 0xff
            weightedR += r * alpha
            weightedG += g * alpha
            weightedB += b * alpha
            totalAlpha += alpha
        }
        this.flashes = survivors

        if (totalAlpha <= 0) {
            overlay.setAlpha(0)
            overlay.setVisible(false)
            return
        }

        const finalAlpha = Math.min(1, totalAlpha)
        const r = Math.min(255, Math.round(weightedR / totalAlpha))
        const g = Math.min(255, Math.round(weightedG / totalAlpha))
        const b = Math.min(255, Math.round(weightedB / totalAlpha))
        overlay.fillColor = (r << 16) | (g << 8) | b
        overlay.setAlpha(finalAlpha)
        overlay.setVisible(true)
    }

    override onDestroy(): void {
        this.scene.scale.off('resize', this.resize, this)
        this.overlay?.destroy()
        this.overlay = null
        this.flashes = []
    }

}
