import type { GameObjects } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

export default class LetterboxFeature extends Feature {

    private targetAspect: number = 16 / 9

    private barColor: number = 0x000000

    private topBar: GameObjects.Rectangle | null = null

    private bottomBar: GameObjects.Rectangle | null = null

    private leftBar: GameObjects.Rectangle | null = null

    private rightBar: GameObjects.Rectangle | null = null

    private barDepth: number = 1000

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setAspect(aspect: number): this {
        if (aspect <= 0) throw new Error('aspect must be > 0')
        this.targetAspect = aspect
        this.layout()
        return this
    }

    setBarColor(color: number): this {
        this.barColor = color
        for (const bar of [this.topBar, this.bottomBar, this.leftBar, this.rightBar]) {
            if (bar) bar.fillColor = color
        }
        return this
    }

    setBarDepth(depth: number): this {
        this.barDepth = depth
        for (const bar of [this.topBar, this.bottomBar, this.leftBar, this.rightBar]) {
            if (bar) bar.setDepth(depth)
        }
        return this
    }

    override onCreate(): void {
        const make = (): GameObjects.Rectangle => {
            const rect = this.scene.add.rectangle(0, 0, 1, 1, this.barColor)
            rect.setOrigin(0, 0)
            rect.setScrollFactor(0)
            rect.setDepth(this.barDepth)
            return rect
        }
        this.topBar = make()
        this.bottomBar = make()
        this.leftBar = make()
        this.rightBar = make()
        this.scene.scale.on('resize', this.layout, this)
        this.layout()
    }

    private layout(): void {
        const { width, height } = this.scene.scale
        const currentAspect = width / height

        const reset = (bar: GameObjects.Rectangle | null) => {
            if (!bar) return
            bar.setSize(0, 0)
            bar.setVisible(false)
        }

        if (Math.abs(currentAspect - this.targetAspect) < 0.001) {
            reset(this.topBar)
            reset(this.bottomBar)
            reset(this.leftBar)
            reset(this.rightBar)
            return
        }

        if (currentAspect > this.targetAspect) {
            // pillarbox (vertical bars)
            const safeWidth = height * this.targetAspect
            const barWidth = (width - safeWidth) * 0.5
            this.leftBar?.setPosition(0, 0).setSize(barWidth, height).setVisible(true)
            this.rightBar?.setPosition(width - barWidth, 0).setSize(barWidth, height).setVisible(true)
            reset(this.topBar)
            reset(this.bottomBar)
        } else {
            // letterbox (horizontal bars)
            const safeHeight = width / this.targetAspect
            const barHeight = (height - safeHeight) * 0.5
            this.topBar?.setPosition(0, 0).setSize(width, barHeight).setVisible(true)
            this.bottomBar?.setPosition(0, height - barHeight).setSize(width, barHeight).setVisible(true)
            reset(this.leftBar)
            reset(this.rightBar)
        }
    }

    override onDestroy(): void {
        this.scene.scale.off('resize', this.layout, this)
        this.topBar?.destroy()
        this.bottomBar?.destroy()
        this.leftBar?.destroy()
        this.rightBar?.destroy()
    }

}
