import { Scene, Debugger } from '@toolcase/phaser-plus'
import { ConsoleCommands } from '@toolcase/phaser-plus'

class ConsoleCommandsDemo extends Scene {

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        const console = dbg.addPanel('console', ConsoleCommands, 'Console')

        console.register('spawn', (args) => {
            const n = parseInt(args[0] ?? '1', 10)
            for (let i = 0; i < n; i++) {
                const x = Math.random() * 800
                const y = 150 + Math.random() * 400
                this.add.image(x, y, 'objects', 'turtle_left').setScale(0.5)
            }
            return `spawned ${n}`
        })

        console.register('clear', () => {
            const list = this.children.list.slice()
            let removed = 0
            for (const c of list) {
                if (c.texture && c.texture.key === 'objects') {
                    c.destroy()
                    removed += 1
                }
            }
            return `removed ${removed}`
        })

        console.register('time', () => `t=${(this.game.loop.time | 0)}ms`)

        console.register('crash', () => {
            throw new Error('intentional')
        })
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60,
            'ConsoleCommands — open Debugger > Console', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Try: /spawn 50, /clear, /time, /crash. Click "List commands".', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)
    }
}

export default ConsoleCommandsDemo
