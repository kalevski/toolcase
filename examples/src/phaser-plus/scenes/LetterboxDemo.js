import { Scene, LetterboxFeature } from '@toolcase/phaser-plus'
import { Input } from 'phaser'

class LetterboxDemo extends Scene {

    /** @type {LetterboxFeature} */ box = null
    /** @type {Phaser.GameObjects.Text} */ label = null
    aspects = [16 / 9, 4 / 3, 1, 21 / 9, 9 / 16]
    aspectIndex = 0

    onCreate() {
        const { width, height } = this.game.config

        this.cameras.main.setBackgroundColor('#1e293b')

        const g = this.add.graphics()
        g.lineStyle(2, 0x60a5fa, 1)
        g.strokeRect(40, 40, width - 80, height - 80)
        for (let i = 0; i < 6; i++) {
            this.add.circle(width * 0.2 + i * 80, height / 2, 30, 0xfbbf24)
        }
        this.add.text(width / 2, height / 2 + 80, 'safe area inside bars', { color: '#fff', fontSize: '20px' }).setOrigin(0.5)

        this.label = this.add.text(20, 20, '', { color: '#fff', fontSize: '20px' }).setScrollFactor(0)
        this.add.text(20, 50, 'A: cycle aspect', { color: '#94a3b8', fontSize: '14px' }).setScrollFactor(0)

        this.box = this.features.register('letterbox', LetterboxFeature)
            .setAspect(this.aspects[0])
            .setBarColor(0x000000)
            .setBarDepth(2000)

        this.refreshLabel()

        const codes = Input.Keyboard.KeyCodes
        const kb = this.input.keyboard
        kb.addKey(codes.A).on('down', () => {
            this.aspectIndex = (this.aspectIndex + 1) % this.aspects.length
            this.box.setAspect(this.aspects[this.aspectIndex])
            this.refreshLabel()
        })
    }

    refreshLabel() {
        const a = this.aspects[this.aspectIndex]
        this.label.setText(`target aspect: ${a.toFixed(3)}`)
    }

}

export default LetterboxDemo
