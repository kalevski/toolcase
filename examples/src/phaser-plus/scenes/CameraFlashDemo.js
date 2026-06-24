import { Scene, CameraFlash } from '@toolcase/phaser-plus'
import { Input } from 'phaser'

class CameraFlashDemo extends Scene {

    /** @type {CameraFlash} */ flash = null
    /** @type {Phaser.GameObjects.Text} */ label = null

    onCreate() {
        const { width, height } = this.game.config

        // Backdrop content so the flash overlay has something to wash over.
        const g = this.add.graphics()
        g.lineStyle(1, 0x334155, 0.8)
        for (let x = 0; x <= width; x += 60) {
            g.lineBetween(x, 0, x, height)
        }
        for (let y = 0; y <= height; y += 60) {
            g.lineBetween(0, y, width, y)
        }
        this.add.rectangle(width / 2, height / 2, 180, 180, 0x3b82f6)
        this.add.circle(width / 2 - 240, height / 2, 70, 0xec4899)
        this.add.circle(width / 2 + 240, height / 2, 70, 0x22c55e)

        this.add.text(width / 2, 60, 'Click for a hit flash', { color: '#fff', fontSize: '24px' }).setOrigin(0.5)
        this.label = this.add.text(width / 2, 96, 'idle', { color: '#94a3b8', fontSize: '16px' }).setOrigin(0.5)

        // The feature owns a screen-space overlay; flashes stack additively.
        this.flash = this.features.register('flash', CameraFlash)

        // Click: quick white hit. Shift+Click: white hit with a hold frame.
        this.input.on('pointerdown', p => {
            if (p.event.shiftKey) {
                this.flash.flash(0xffffff, 0.4, 0.06)
                this.label.setText('white hold flash (0.4 s + hold)')
            } else {
                this.flash.flash(0xffffff, 0.25)
                this.label.setText('white hit (0.25 s)')
            }
        })

        const codes = Input.Keyboard.KeyCodes
        const kb = this.input.keyboard
        kb.addKey(codes.ONE).on('down', () => {
            this.flash.flash(0xff2244, 0.5, 0.05)
            this.label.setText('red damage flash')
        })
        kb.addKey(codes.TWO).on('down', () => {
            this.flash.flash(0x38bdf8, 0.6)
            this.label.setText('cyan pickup flash')
        })
        kb.addKey(codes.THREE).on('down', () => {
            // Stack several flashes in one frame to show additive blending.
            this.flash.flash(0xffffff, 0.3)
            this.flash.flash(0xfbbf24, 0.5)
            this.label.setText('stacked white + amber')
        })
        kb.addKey(codes.C).on('down', () => {
            this.flash.clear()
            this.label.setText('cleared')
        })

        this.add.text(20, height - 30,
            'Click: white hit • Shift+Click: hold • 1: red • 2: cyan • 3: stack • C: clear',
            { color: '#94a3b8', fontSize: '14px' }
        ).setScrollFactor(0)
    }

}

export default CameraFlashDemo
