import { Scene, StateMachine, STATE_TRANSITION } from '@toolcase/phaser-plus'
import { Input } from 'phaser'

class StateMachineDemo extends Scene {

    /** @type {StateMachine} */ machine = null
    /** @type {Phaser.GameObjects.Rectangle} */ box = null
    /** @type {Phaser.GameObjects.Text} */ label = null

    onCreate() {
        const { width, height } = this.game.config
        this.box = this.add.rectangle(width / 2, height / 2, 80, 80, 0x4ade80)
        this.label = this.add.text(width / 2, 60, '', { color: '#fff', fontSize: '24px' }).setOrigin(0.5)

        const ctx = { box: this.box, vy: 0, ground: height / 2 }

        this.machine = this.features.register('player-fsm', StateMachine).setContext(ctx)

        this.machine
            .addState('idle', {
                onEnter: c => { c.box.fillColor = 0x4ade80 }
            })
            .addState('run', {
                onEnter: c => { c.box.fillColor = 0x60a5fa },
                onUpdate: (c, _t, delta) => { c.box.x += 0.3 * delta }
            })
            .addState('jump', {
                onEnter: c => { c.box.fillColor = 0xf472b6; c.vy = -10 },
                onUpdate: (c, _t, delta) => {
                    c.vy += 0.4 * delta * 0.05
                    c.box.y += c.vy
                    if (c.box.y >= c.ground) { c.box.y = c.ground; c.vy = 0 }
                }
            })
            .addTransition('idle', 'run', 'move')
            .addTransition('run', 'idle', 'stop')
            .addTransition(null, 'jump', 'jump')
            .addTransition('jump', 'idle', null, c => c.box.y >= c.ground)

        this.features.on(STATE_TRANSITION, (from, to) => {
            this.label.setText(`state: ${from ?? '∅'} → ${to}`)
        })

        this.add.text(20, 20,
            'A: move • S: stop • Space: jump',
            { color: '#cbd5e1', fontSize: '16px' }
        )

        const codes = Input.Keyboard.KeyCodes
        const kb = this.input.keyboard
        kb.addKey(codes.A).on('down', () => this.machine.fire('move'))
        kb.addKey(codes.S).on('down', () => this.machine.fire('stop'))
        kb.addKey(codes.SPACE).on('down', () => this.machine.fire('jump'))
    }

}

export default StateMachineDemo
