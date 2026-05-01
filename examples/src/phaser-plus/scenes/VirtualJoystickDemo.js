import {
    Scene,
    InputFeature,
    VirtualJoystick,
    VIRTUAL_AXIS_X,
    VIRTUAL_AXIS_Y
} from '@toolcase/phaser-plus'

class VirtualJoystickDemo extends Scene {

    /** @type {InputFeature} */ inputFeature = null
    /** @type {VirtualJoystick} */ joystick = null
    /** @type {Phaser.GameObjects.Rectangle} */ player = null
    /** @type {Phaser.GameObjects.Text} */ status = null

    onCreate() {
        const { width, height } = this.game.config
        this.player = this.add.rectangle(width / 2, height / 2, 60, 60, 0xf472b6)

        this.add.text(20, 20,
            'Drag joystick to move. Press buttons. Touch-friendly.',
            { color: '#fff', fontSize: '16px' }
        )
        this.status = this.add.text(20, 50, '', { color: '#cbd5e1', fontSize: '14px' })

        this.inputFeature = this.features.register('input', InputFeature)
        this.inputFeature.bind('left', [{ type: 'virtual', id: `${VIRTUAL_AXIS_X}:negative` }])
        this.inputFeature.bind('right', [{ type: 'virtual', id: `${VIRTUAL_AXIS_X}:positive` }])
        this.inputFeature.bind('up', [{ type: 'virtual', id: `${VIRTUAL_AXIS_Y}:negative` }])
        this.inputFeature.bind('down', [{ type: 'virtual', id: `${VIRTUAL_AXIS_Y}:positive` }])
        this.inputFeature.bind('A', [{ type: 'virtual', id: 'A' }])
        this.inputFeature.bind('B', [{ type: 'virtual', id: 'B' }])

        this.joystick = this.features.register('joystick', VirtualJoystick)
        this.joystick.setInput(this.inputFeature)
        this.joystick.setJoystickConfig({ size: 160, deadZone: 0.15, placement: 'left' })
        this.joystick.addButton({ id: 'A', label: 'A', placement: 'right', size: 80, sideOffset: 32, bottomOffset: 60 })
        this.joystick.addButton({ id: 'B', label: 'B', placement: 'right', size: 80, sideOffset: 130, bottomOffset: 130 })
    }

    onUpdate(_t, delta) {
        if (!this.inputFeature) return
        const speed = 0.4 * delta
        if (this.inputFeature.isPressed('left')) this.player.x -= speed
        if (this.inputFeature.isPressed('right')) this.player.x += speed
        if (this.inputFeature.isPressed('up')) this.player.y -= speed
        if (this.inputFeature.isPressed('down')) this.player.y += speed

        const v = this.joystick?.vector ?? { x: 0, y: 0 }
        const a = this.inputFeature.isPressed('A') ? 'A ' : ''
        const b = this.inputFeature.isPressed('B') ? 'B' : ''
        this.status.setText(`vector: ${v.x.toFixed(2)}, ${v.y.toFixed(2)} • buttons: ${a}${b}`)
    }

}

export default VirtualJoystickDemo
