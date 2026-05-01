import {
    Scene,
    InputFeature,
    InputBuffer,
    ACTION_PRESS
} from '@toolcase/phaser-plus'

class InputBufferDemo extends Scene {

    /** @type {InputFeature} */ inputFeature = null
    /** @type {InputBuffer} */ buffer = null
    /** @type {Phaser.GameObjects.Text} */ log = null
    /** @type {Phaser.GameObjects.Text} */ combo = null
    logLines = []

    onCreate() {
        this.add.text(20, 20,
            'Press DOWN, RIGHT, A within 600ms for fireball.\nDOUBLE-TAP A within 250ms for flurry.',
            { color: '#fff', fontSize: '18px' }
        )
        this.combo = this.add.text(20, 80, '', { color: '#fbbf24', fontSize: '24px' })
        this.log = this.add.text(20, 130, '', { color: '#cbd5e1', fontSize: '14px' })

        this.buffer = this.features.register('buffer', InputBuffer)
            .setCapacity(32)
            .setWindow(600)

        this.inputFeature = this.features.register('input', InputFeature).setBuffer(this.buffer)
        this.inputFeature.bind('down', [{ type: 'key', code: 'DOWN' }, { type: 'key', code: 'S' }])
        this.inputFeature.bind('right', [{ type: 'key', code: 'RIGHT' }, { type: 'key', code: 'D' }])
        this.inputFeature.bind('A', [{ type: 'key', code: 'J' }])

        this.features.on(ACTION_PRESS, action => {
            this.append(`press ${action}`)
            if (this.buffer.consumeMatch(['down', 'right', 'A'])) {
                this.flash('FIREBALL!')
                return
            }
            if (action === 'A' && this.buffer.consumeMatch(['A', 'A'], 250)) {
                this.flash('flurry x2!')
            }
        })
    }

    append(line) {
        this.logLines.push(line)
        if (this.logLines.length > 12) this.logLines.shift()
        this.log.setText(this.logLines.join('\n'))
    }

    flash(text) {
        this.combo.setText(text)
        this.time.delayedCall(800, () => { this.combo.setText('') })
    }

}

export default InputBufferDemo
