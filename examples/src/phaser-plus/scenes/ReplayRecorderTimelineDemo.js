import { Scene, Debugger, ReplayRecorder, REPLAY_FRAME, REPLAY_END } from '@toolcase/phaser-plus'
import { TimelinePanel } from '@toolcase/phaser-plus'
import { Input } from 'phaser'

const W = 800
const H = 540

class ReplayRecorderTimelineDemo extends Scene {

    /** @type {ReplayRecorder} */ recorder = null
    /** @type {TimelinePanel} */ panel = null
    /** @type {Phaser.GameObjects.Rectangle} */ box = null
    /** @type {Phaser.GameObjects.Text} */ statusLabel = null
    keys = { left: null, right: null, up: null, down: null }

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        this.panel = dbg.addPanel('timeline', TimelinePanel, 'Replay Timeline')
    }

    onCreate() {
        this.box = this.add.rectangle(W / 2, H / 2, 60, 60, 0xfbbf24)

        this.statusLabel = this.add.text(W / 2, 28,
            'idle — open Debugger > Replay Timeline',
            { font: '15px Courier', color: '#94a3b8' }
        ).setOrigin(0.5)

        this.add.text(W / 2, H - 36,
            'R: record  •  P: playback  •  S: stop  •  Arrows: move (during recording)',
            { font: '13px Courier', color: '#64748b' }
        ).setOrigin(0.5)

        const codes = Input.Keyboard.KeyCodes
        const kb = this.input.keyboard
        this.keys.left  = kb.addKey(codes.LEFT)
        this.keys.right = kb.addKey(codes.RIGHT)
        this.keys.up    = kb.addKey(codes.UP)
        this.keys.down  = kb.addKey(codes.DOWN)

        this.recorder = this.features.register('replay', ReplayRecorder)

        this.features.on(REPLAY_FRAME, (_tick, inputs) => {
            if (this.recorder.state !== 'playing') return
            if (inputs.left)  this.box.x -= 4
            if (inputs.right) this.box.x += 4
            if (inputs.up)    this.box.y -= 4
            if (inputs.down)  this.box.y += 4
        })

        this.features.on(REPLAY_END, () => {
            this.statusLabel.setText('replay end')
        })

        this.panel.bindReplay(this.recorder)

        kb.addKey(codes.R).on('down', () => {
            this.box.setPosition(W / 2, H / 2)
            this.recorder.record(1, 60)
            this.statusLabel.setText('recording…')
        })

        kb.addKey(codes.P).on('down', () => {
            const session = this.recorder.session
            if (!session || session.frames.length === 0) {
                this.statusLabel.setText('nothing to play')
                return
            }
            this.box.setPosition(W / 2, H / 2)
            this.recorder.play(session)
            this.statusLabel.setText(`playing ${session.frames.length} frames`)
        })

        kb.addKey(codes.S).on('down', () => {
            this.recorder.stop()
            this.statusLabel.setText('stopped')
        })
    }

    onUpdate() {
        if (this.recorder?.state !== 'recording') return
        if (this.keys.left.isDown)  { this.box.x -= 4; this.recorder.setInput('left', true) }
        if (this.keys.right.isDown) { this.box.x += 4; this.recorder.setInput('right', true) }
        if (this.keys.up.isDown)    { this.box.y -= 4; this.recorder.setInput('up', true) }
        if (this.keys.down.isDown)  { this.box.y += 4; this.recorder.setInput('down', true) }
    }

}

export default ReplayRecorderTimelineDemo
