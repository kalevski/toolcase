import { Scene, DialogCameraCue } from '@toolcase/phaser-plus'
import { Input } from 'phaser'

class DialogCameraCueDemo extends Scene {

    /** @type {DialogCameraCue} */ cue = null
    /** @type {Phaser.GameObjects.Text} */ label = null
    /** @type {boolean} */ vignette = true

    onCreate() {
        const { width, height } = this.game.config
        const cx = width / 2
        const cy = height / 2

        // Busy scene so the dim/focus frame is visible against the surroundings.
        const g = this.add.graphics()
        g.lineStyle(1, 0x334155, 0.7)
        for (let x = 0; x <= width; x += 48) g.lineBetween(x, 0, x, height)
        for (let y = 0; y <= height; y += 48) g.lineBetween(0, y, width, y)

        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2
            this.add.circle(cx + Math.cos(a) * 220, cy + Math.sin(a) * 150, 26, 0x1e293b)
                .setStrokeStyle(2, 0x475569)
        }

        // NPC stand-in centred where the focus frame lands.
        this.add.rectangle(cx, cy, 60, 110, 0x8b5cf6)
        this.add.text(cx, cy - 78, 'NPC', { color: '#a78bfa', fontSize: '15px' }).setOrigin(0.5)

        this.add.text(cx, 56, 'Press SPACE to focus the NPC', { color: '#fff', fontSize: '22px' }).setOrigin(0.5)
        this.label = this.add.text(cx, 90, 'cue: closed', { color: '#94a3b8', fontSize: '16px' }).setOrigin(0.5)

        // The cue dims everything outside a supplied screen-space frame.
        this.cue = this.features.register('cue', DialogCameraCue)
        this.cue.setDimColor(0x000000).setDimAlpha(0.65).setDefaultFade(0.25)

        // Screen-space frame around the NPC.
        const frame = { x: cx - 150, y: cy - 90, width: 300, height: 200 }

        const codes = Input.Keyboard.KeyCodes
        const kb = this.input.keyboard
        kb.addKey(codes.SPACE).on('down', () => {
            if (this.cue.isOpen()) {
                this.cue.clear()
                this.label.setText('cue: closing')
            } else {
                this.cue.focus(frame, { vignette: this.vignette, fadeSec: 0.3 })
                this.label.setText(`cue: focus NPC${this.vignette ? ' + vignette' : ''}`)
            }
        })
        kb.addKey(codes.F).on('down', () => {
            // Full-screen dim (no frame) — letterbox-free attention pull.
            this.cue.focus(null, { fadeSec: 0.3 })
            this.label.setText('cue: full-screen dim')
        })
        kb.addKey(codes.V).on('down', () => {
            this.vignette = !this.vignette
            this.label.setText(`vignette: ${this.vignette ? 'on' : 'off'}`)
        })
        kb.addKey(codes.C).on('down', () => {
            this.cue.clear()
            this.label.setText('cue: closing')
        })

        this.add.text(20, height - 30,
            'SPACE: toggle focus • F: full dim • V: toggle vignette • C: clear',
            { color: '#94a3b8', fontSize: '14px' }
        ).setScrollFactor(0)
    }

}

export default DialogCameraCueDemo
