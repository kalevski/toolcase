import { Scene, ScreenShake } from '@toolcase/phaser-plus'

class ScreenShakeDemo extends Scene {

    /** @type {ScreenShake} */ shake = null
    /** @type {Phaser.GameObjects.Text} */ label = null

    onCreate() {
        const { width, height } = this.game.config

        const g = this.add.graphics()
        g.lineStyle(2, 0x475569, 1)
        for (let i = 0; i < 16; i++) {
            const r = 30 + i * 30
            g.strokeCircle(width / 2, height / 2, r)
        }

        this.add.text(width / 2, 60, 'Click to add trauma', { color: '#fff', fontSize: '24px' }).setOrigin(0.5)
        this.label = this.add.text(width / 2, 96, 'trauma queue: 0', { color: '#94a3b8', fontSize: '16px' }).setOrigin(0.5)

        this.shake = this.features
            .register('shake', ScreenShake)
            .setMaxOffset(24)
            .setMaxAngle(0.06)
            .setExponent(2)

        this.input.on('pointerdown', p => {
            const trauma = p.event.shiftKey ? 0.9 : 0.4
            this.shake.add(trauma, /* decay */ 1)
            this.label.setText('trauma queue: +' + trauma.toFixed(2))
        })

        this.add.text(20, height - 30,
            'Click: small shake • Shift+Click: big shake (stacks)',
            { color: '#94a3b8', fontSize: '14px' }
        ).setScrollFactor(0)
    }

}

export default ScreenShakeDemo
