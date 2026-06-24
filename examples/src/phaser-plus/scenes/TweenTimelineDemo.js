import { Scene, Debugger, Flow } from '@toolcase/phaser-plus'
import { TimelinePanel } from '@toolcase/phaser-plus'

const W = 800
const H = 540
const COLS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6]
const EASES = ['easeOutCubic', 'easeInOut', 'bounce', 'elastic', 'easeOutBack']

class TweenTimelineDemo extends Scene {

    /** @type {TimelinePanel} */ panel = null
    /** @type {import('@toolcase/phaser-plus').TimelineHandle} */ tlHandle = null
    /** @type {Phaser.GameObjects.Text|null} */ doneLabel = null
    boxes = []

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        this.panel = dbg.addPanel('timeline', TimelinePanel, 'Tween Timeline')
    }

    onCreate() {
        this.add.text(W / 2, 18,
            'Tween Timeline — open Debugger > Tween Timeline for scrub + replay',
            { font: '13px Courier', color: '#94a3b8' }).setOrigin(0.5)

        this.add.text(20, H - 28,
            'R: replay  •  SPACE: pause / resume',
            { font: '13px Courier', color: '#64748b' })

        for (let i = 0; i < COLS.length; i++) {
            const y = 90 + i * 78
            this.boxes.push(this.add.rectangle(80, y, 50, 50, COLS[i]))
            this.add.text(144, y, EASES[i], { font: '11px Courier', color: '#94a3b8' }).setOrigin(0, 0.5)
        }

        this.tlHandle = this._buildAndPlay()
        this.panel.bindTimeline(this.tlHandle)

        const kb = this.input.keyboard
        kb.addKey('R').on('down', () => this._replay())
        kb.addKey('SPACE').on('down', () => {
            if (this.tlHandle.paused) this.tlHandle.resume()
            else this.tlHandle.pause()
        })
    }

    _buildAndPlay() {
        const tl = new Flow.Timeline(this)

        for (let i = 0; i < this.boxes.length; i++) {
            tl.to(this.boxes[i], { x: W - 80 }, { ms: 1000 + i * 80, ease: EASES[i] })
        }

        tl.wait(300)

        tl.parallel(sub => {
            for (const box of this.boxes) {
                sub.to(box, { alpha: 0, scaleX: 0.3, scaleY: 0.3 }, { ms: 500, ease: 'easeIn' })
            }
        })

        tl.stagger(
            this.boxes,
            { x: 80, alpha: 1, scaleX: 1, scaleY: 1 },
            { ms: 400, ease: 'easeOutBack' },
            100
        )

        return tl.play(() => {
            this.doneLabel = this.add.text(W / 2, H / 2,
                'Sequence complete — press R to replay',
                { font: 'bold 18px Courier', color: '#4ade80' }).setOrigin(0.5).setDepth(10)
        })
    }

    _replay() {
        this.doneLabel?.destroy()
        this.doneLabel = null

        for (const box of this.boxes) {
            box.x = 80
            box.alpha = 1
            box.scaleX = 1
            box.scaleY = 1
        }

        this.tlHandle.restart()
    }

}

export default TweenTimelineDemo
