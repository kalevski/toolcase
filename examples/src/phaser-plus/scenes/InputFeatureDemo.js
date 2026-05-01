import { Scene, InputFeature, ACTION_PRESS, ACTION_RELEASE } from '@toolcase/phaser-plus'

class InputFeatureDemo extends Scene {

    /** @type {InputFeature} */ inputFeature = null
    /** @type {Phaser.GameObjects.Rectangle} */ player = null
    /** @type {Phaser.GameObjects.Text} */ log = null
    logLines = []

    onCreate() {
        const { width, height } = this.game.config
        this.player = this.add.rectangle(width / 2, height / 2, 60, 60, 0x60a5fa)

        this.add.text(20, 20,
            'WASD or Arrows: move • Space: bonk',
            { color: '#fff', fontSize: '18px' }
        )
        this.log = this.add.text(20, 60, '', { color: '#cbd5e1', fontSize: '14px' })

        this.inputFeature = this.features.register('input', InputFeature)
        this.inputFeature.bind('left', [
            { type: 'key', code: 'A' }, { type: 'key', code: 'LEFT' }
        ])
        this.inputFeature.bind('right', [
            { type: 'key', code: 'D' }, { type: 'key', code: 'RIGHT' }
        ])
        this.inputFeature.bind('up', [
            { type: 'key', code: 'W' }, { type: 'key', code: 'UP' }
        ])
        this.inputFeature.bind('down', [
            { type: 'key', code: 'S' }, { type: 'key', code: 'DOWN' }
        ])
        this.inputFeature.bind('bonk', [{ type: 'key', code: 'SPACE' }])

        this.features.on(ACTION_PRESS, action => this.append(`press ${action}`))
        this.features.on(ACTION_RELEASE, (action, holdMs) =>
            this.append(`release ${action} (${holdMs.toFixed(0)} ms)`)
        )
    }

    onUpdate(_t, delta) {
        if (!this.inputFeature) return
        const speed = 0.4 * delta
        if (this.inputFeature.isPressed('left')) this.player.x -= speed
        if (this.inputFeature.isPressed('right')) this.player.x += speed
        if (this.inputFeature.isPressed('up')) this.player.y -= speed
        if (this.inputFeature.isPressed('down')) this.player.y += speed
        if (this.inputFeature.isPressed('bonk')) {
            this.player.angle = (this.player.angle + 8) % 360
        }
    }

    append(line) {
        this.logLines.push(line)
        if (this.logLines.length > 10) this.logLines.shift()
        this.log.setText(this.logLines.join('\n'))
    }

}

export default InputFeatureDemo
