import { Scene, ReplayRecorder, REPLAY_FRAME, REPLAY_END } from '@toolcase/phaser-plus'
import { Input } from 'phaser'

class ReplayRecorderDemo extends Scene {

    /** @type {ReplayRecorder} */ recorder = null
    /** @type {Phaser.GameObjects.Rectangle} */ box = null
    /** @type {Phaser.GameObjects.Text} */ label = null
    keys = { left: null, right: null, up: null, down: null }

    onCreate() {
        const { width, height } = this.game.config
        this.box = this.add.rectangle(width / 2, height / 2, 60, 60, 0xfbbf24)
        this.label = this.add.text(20, 20, 'idle', { color: '#fff', fontSize: '20px' })

        this.add.text(20, height - 60,
            'R: record • P: playback • S: stop\nArrows: move (during recording)',
            { color: '#94a3b8', fontSize: '14px' }
        )

        const codes = Input.Keyboard.KeyCodes
        const kb = this.input.keyboard
        this.keys.left = kb.addKey(codes.LEFT)
        this.keys.right = kb.addKey(codes.RIGHT)
        this.keys.up = kb.addKey(codes.UP)
        this.keys.down = kb.addKey(codes.DOWN)

        this.recorder = this.features.register('replay', ReplayRecorder)

        this.features.on(REPLAY_FRAME, (_tick, inputs) => {
            if (this.recorder.state !== 'playing') return
            if (inputs.left) this.box.x -= 4
            if (inputs.right) this.box.x += 4
            if (inputs.up) this.box.y -= 4
            if (inputs.down) this.box.y += 4
        })
        this.features.on(REPLAY_END, () => { this.label.setText('replay end') })

        kb.addKey(codes.R).on('down', () => {
            this.box.setPosition(width / 2, height / 2)
            this.recorder.record(1, 60)
            this.label.setText('recording…')
        })
        kb.addKey(codes.P).on('down', () => {
            const session = this.recorder.session
            if (!session || session.frames.length === 0) {
                this.label.setText('nothing to play')
                return
            }
            this.box.setPosition(width / 2, height / 2)
            this.recorder.play(session)
            this.label.setText(`playing ${session.frames.length} frames`)
        })
        kb.addKey(codes.S).on('down', () => {
            this.recorder.stop()
            this.label.setText('stopped')
        })
    }

    onUpdate() {
        if (this.recorder?.state !== 'recording') return
        if (this.keys.left.isDown) { this.box.x -= 4; this.recorder.setInput('left', true) }
        if (this.keys.right.isDown) { this.box.x += 4; this.recorder.setInput('right', true) }
        if (this.keys.up.isDown) { this.box.y -= 4; this.recorder.setInput('up', true) }
        if (this.keys.down.isDown) { this.box.y += 4; this.recorder.setInput('down', true) }
    }

}

export default ReplayRecorderDemo
