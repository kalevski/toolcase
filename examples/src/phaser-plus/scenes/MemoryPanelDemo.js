import { Scene, Debugger } from '@toolcase/phaser-plus'
import { MemoryPanel } from '@toolcase/phaser-plus'

class MemoryPanelDemo extends Scene {

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        dbg.addPanel('mem', MemoryPanel, 'Memory')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60,
            'MemoryPanel — open Debugger > Memory', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Click: spawn images. Right-click: spawn text. Watch Objects + By type.', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)

        this.input.on('pointerdown', (pointer) => {
            const x = pointer.x
            const y = pointer.y
            if (pointer.rightButtonDown()) {
                this.add.text(x, y, 'T', { font: '16px Arial', color: '#fff' })
            } else {
                this.add.image(x, y, 'objects', 'turtle_left').setScale(0.5)
            }
        })
    }
}

export default MemoryPanelDemo
