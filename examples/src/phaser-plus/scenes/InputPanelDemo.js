import { Scene, Debugger } from '@toolcase/phaser-plus'
import { InputPanel } from '@toolcase/phaser-plus'

class InputPanelDemo extends Scene {

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        const panel = dbg.addPanel('input', InputPanel, 'Input')

        // Demo action map. The InputPanel polls these every tick.
        const keyboard = () => this.input.keyboard
        panel.registerAction('jump', () => keyboard()?.checkDown(keyboard().addKey('SPACE')) ?? false)
        panel.registerAction('left', () => keyboard()?.checkDown(keyboard().addKey('A')) ?? false)
        panel.registerAction('right', () => keyboard()?.checkDown(keyboard().addKey('D')) ?? false)
        panel.registerAction('mouse', () => this.input.activePointer?.isDown ?? false)
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60,
            'InputPanel — open Debugger > Input', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Press WASD/Space, move mouse, plug in a gamepad. Watch live state.', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)
    }
}

export default InputPanelDemo
