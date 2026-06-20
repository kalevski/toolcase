import type { GameObjects } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

export interface DialogFrame {
    x: number
    y: number
    width: number
    height: number
}

export interface DialogCueOpts {
    fadeSec?: number
    blur?: boolean
    vignette?: boolean
}

type CueState = 'closed' | 'opening' | 'open' | 'closing'

export default class DialogCameraCue extends Feature {

    private dimColor: number = 0x000000

    private dimAlpha: number = 0.55

    private depth: number = 1090

    private defaultFadeSec: number = 0.25

    private panels: GameObjects.Rectangle[] = []

    private vignettePanels: GameObjects.Rectangle[] = []

    private state: CueState = 'closed'

    private alphaT: number = 0

    private fadeSec: number = 0.25

    private elapsed: number = 0

    private frame: DialogFrame | null = null

    private blurEnabled: boolean = false

    private blurFx: unknown = null

    private vignetteEnabled: boolean = false

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setDimColor(color: number): this {
        this.dimColor = color
        for (const r of this.panels) r.fillColor = color
        for (const r of this.vignettePanels) r.fillColor = color
        return this
    }

    setDimAlpha(alpha: number): this {
        this.dimAlpha = Math.max(0, Math.min(1, alpha))
        return this
    }

    setDepth(depth: number): this {
        this.depth = depth
        for (const r of this.panels) r.setDepth(depth)
        for (const r of this.vignettePanels) r.setDepth(depth + 1)
        return this
    }

    setDefaultFade(durationSec: number): this {
        this.defaultFadeSec = Math.max(0, durationSec)
        return this
    }

    focus(frame: DialogFrame | null, opts: DialogCueOpts = {}): this {
        this.frame = frame === null ? null : { ...frame }
        this.fadeSec = Math.max(0, opts.fadeSec ?? this.defaultFadeSec)
        this.vignetteEnabled = opts.vignette === true
        const wantBlur = opts.blur === true
        if (wantBlur !== this.blurEnabled) {
            this.toggleBlur(wantBlur)
        }
        if (this.state === 'closed') {
            this.alphaT = 0
            this.elapsed = 0
        } else {
            this.elapsed = this.alphaT * this.fadeSec
        }
        this.state = 'opening'
        this.layout()
        return this
    }

    clear(): this {
        if (this.state === 'closed') return this
        this.elapsed = (1 - this.alphaT) * this.fadeSec
        this.state = 'closing'
        if (this.blurEnabled) this.toggleBlur(false)
        return this
    }

    isOpen(): boolean {
        return this.state !== 'closed'
    }

    private toggleBlur(enable: boolean): void {
        const cam = this.scene.cameras.main as unknown as {
            postFX?: { addBlur?: (...args: unknown[]) => unknown, remove?: (fx: unknown) => void }
        }
        if (enable) {
            const add = cam.postFX?.addBlur
            if (typeof add === 'function') {
                this.blurFx = add.call(cam.postFX, 0, 2, 2, 1, 0xffffff, 4)
                this.blurEnabled = true
            } else {
                this.logger.warning('camera postFX.addBlur unavailable; blur skipped')
            }
            return
        }
        const remove = cam.postFX?.remove
        if (this.blurFx !== null && typeof remove === 'function') {
            remove.call(cam.postFX, this.blurFx)
        }
        this.blurFx = null
        this.blurEnabled = false
    }

    override onCreate(): void {
        const makePanel = (depth: number): GameObjects.Rectangle => {
            const rect = this.scene.add.rectangle(0, 0, 1, 1, this.dimColor)
            rect.setOrigin(0, 0)
            rect.setScrollFactor(0)
            rect.setDepth(depth)
            rect.setAlpha(0)
            rect.setVisible(false)
            return rect
        }
        for (let i = 0; i < 4; i++) {
            this.panels.push(makePanel(this.depth))
        }
        for (let i = 0; i < 4; i++) {
            this.vignettePanels.push(makePanel(this.depth + 1))
        }
        this.scene.scale.on('resize', this.layout, this)
    }

    private layout(): void {
        const { width, height } = this.scene.scale
        const [top, bottom, left, right] = this.panels
        const frame = this.frame

        if (frame === null) {
            top.setPosition(0, 0).setSize(width, height).setVisible(true)
            bottom.setVisible(false)
            left.setVisible(false)
            right.setVisible(false)
            this.layoutVignette()
            return
        }

        const fx = Math.max(0, Math.min(width, frame.x))
        const fy = Math.max(0, Math.min(height, frame.y))
        const fw = Math.max(0, Math.min(width - fx, frame.width))
        const fh = Math.max(0, Math.min(height - fy, frame.height))

        top.setPosition(0, 0).setSize(width, fy).setVisible(fy > 0)
        bottom.setPosition(0, fy + fh).setSize(width, height - (fy + fh)).setVisible(fy + fh < height)
        left.setPosition(0, fy).setSize(fx, fh).setVisible(fx > 0 && fh > 0)
        right.setPosition(fx + fw, fy).setSize(width - (fx + fw), fh).setVisible(fx + fw < width && fh > 0)

        this.layoutVignette()
    }

    private layoutVignette(): void {
        const [vTop, vBottom, vLeft, vRight] = this.vignettePanels
        const enabled = this.vignetteEnabled && this.frame !== null
        if (!enabled) {
            vTop.setVisible(false)
            vBottom.setVisible(false)
            vLeft.setVisible(false)
            vRight.setVisible(false)
            return
        }
        const f = this.frame as DialogFrame
        const ring = Math.min(24, Math.min(f.width, f.height) * 0.2)
        if (ring <= 0) {
            vTop.setVisible(false)
            vBottom.setVisible(false)
            vLeft.setVisible(false)
            vRight.setVisible(false)
            return
        }
        vTop.setPosition(f.x, f.y).setSize(f.width, ring).setVisible(true)
        vBottom.setPosition(f.x, f.y + f.height - ring).setSize(f.width, ring).setVisible(true)
        const innerH = Math.max(0, f.height - ring * 2)
        vLeft.setPosition(f.x, f.y + ring).setSize(ring, innerH).setVisible(innerH > 0)
        vRight.setPosition(f.x + f.width - ring, f.y + ring).setSize(ring, innerH).setVisible(innerH > 0)
    }

    override onUpdate(_time: number, delta: number): void {
        if (this.state === 'closed') return
        const dt = delta / 1000
        const dur = Math.max(0.0001, this.fadeSec)

        if (this.state === 'opening') {
            this.elapsed += dt
            const t = Math.min(1, this.elapsed / dur)
            this.alphaT = t
            if (t >= 1) this.state = 'open'
        } else if (this.state === 'closing') {
            this.elapsed += dt
            const t = Math.min(1, this.elapsed / dur)
            this.alphaT = 1 - t
            if (t >= 1) {
                this.state = 'closed'
                this.alphaT = 0
            }
        }

        const a = this.alphaT * this.dimAlpha
        for (const r of this.panels) {
            if (r.visible) r.setAlpha(a)
        }
        for (const r of this.vignettePanels) {
            if (r.visible) r.setAlpha(a * 0.6)
        }

        if (this.state === 'closed') {
            for (const r of this.panels) r.setVisible(false)
            for (const r of this.vignettePanels) r.setVisible(false)
        }
    }

    override onDestroy(): void {
        this.scene.scale.off('resize', this.layout, this)
        for (const r of this.panels) r.destroy()
        for (const r of this.vignettePanels) r.destroy()
        this.panels = []
        this.vignettePanels = []
        if (this.blurEnabled) this.toggleBlur(false)
        this.frame = null
        this.state = 'closed'
        this.alphaT = 0
    }

}
