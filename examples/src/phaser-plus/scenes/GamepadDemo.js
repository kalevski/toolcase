import {
    Scene,
    GamepadFeature,
    GAMEPAD_CONNECTED,
    GAMEPAD_DISCONNECTED,
    GAMEPAD_BUTTON_DOWN
} from '@toolcase/phaser-plus'

class GamepadDemo extends Scene {

    /** @type {GamepadFeature} */ gamepad = null
    /** @type {Phaser.GameObjects.Text} */ status = null
    /** @type {Phaser.GameObjects.Arc} */ stickL = null
    /** @type {Phaser.GameObjects.Arc} */ stickR = null
    /** @type {Phaser.GameObjects.Text} */ log = null
    logLines = []

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(20, 20, 'Connect a controller. Press any button to register.', { color: '#fff', fontSize: '18px' })
        this.status = this.add.text(20, 50, 'no controller', { color: '#cbd5e1', fontSize: '14px' })

        this.add.circle(width * 0.35, height / 2, 80).setStrokeStyle(2, 0x475569)
        this.add.circle(width * 0.65, height / 2, 80).setStrokeStyle(2, 0x475569)
        this.stickL = this.add.circle(width * 0.35, height / 2, 14, 0x60a5fa)
        this.stickR = this.add.circle(width * 0.65, height / 2, 14, 0xf472b6)

        this.log = this.add.text(20, height - 200, '', { color: '#94a3b8', fontSize: '14px' })

        this.gamepad = this.features.register('gamepad', GamepadFeature)
        this.gamepad.setDefaultMapping('xbox')

        this.features.on(GAMEPAD_CONNECTED, (index, id) => {
            this.status.setText(`connected pad ${index}: ${id}`)
            this.append(`connected ${index}`)
        })
        this.features.on(GAMEPAD_DISCONNECTED, index => {
            this.status.setText('disconnected')
            this.append(`disconnected ${index}`)
        })
        this.features.on(GAMEPAD_BUTTON_DOWN, (index, button) => {
            this.append(`pad ${index} button ${button}`)
            this.gamepad.rumble(index, 0.6, 0.3, 200)
        })
    }

    onUpdate() {
        if (!this.gamepad) return
        if (!this.gamepad.isConnected(0)) return
        const a = this.gamepad.axes(0)
        const { width, height } = this.game.config
        this.stickL.x = width * 0.35 + a.x * 70
        this.stickL.y = height / 2 + a.y * 70
        this.stickR.x = width * 0.65 + a.rx * 70
        this.stickR.y = height / 2 + a.ry * 70
    }

    append(line) {
        this.logLines.push(line)
        if (this.logLines.length > 8) this.logLines.shift()
        this.log.setText(this.logLines.join('\n'))
    }

}

export default GamepadDemo
