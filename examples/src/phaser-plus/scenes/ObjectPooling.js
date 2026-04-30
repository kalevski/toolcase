import { Scene } from '@toolcase/phaser-plus'
import World from './layers/World'
import Turtle from './prefabs/Turtle'

class ObjectPooling extends Scene {

    /** @type {World} */
    world = null

    visible = 1

    visibleText = null

    actualText = null

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onCreate() {
        const { width, height } = this.game.config
        this.matter.world.setBounds(-width / 2, -height / 2)

        this.pool.register('turtle', Turtle)

        this.visibleText = this.add.text(20, 20, '', {
            font: '16px Courier',
            color: '#00ff88'
        })
        this.actualText = this.add.text(20, 44, '', {
            font: '16px Courier',
            color: '#00ff88'
        })
        this.add.text(20, 80,
            'LMB = spawn (pooled)   RMB = release (returns to pool)',
            { font: '14px Courier', color: '#aaaaaa' }
        )

        this.world = this.features.register('world', World)
        this.world.add('turtle', 0, -200)
        this.refresh()

        this.input.mouse.disableContextMenu()
        this.input.on('pointerdown', this.onClick, this)
    }

    onClick(event, objects) {
        const [target = null] = objects

        if (event.leftButtonDown()) {
            this.world.add('turtle', event.worldX, event.worldY)
            this.visible++
        } else if (event.rightButtonDown() && target !== null) {
            this.world.remove(target.parentContainer)
            this.visible--
        }
        this.refresh()
    }

    refresh() {
        this.visibleText.setText(`Visible turtles: ${this.visible}`)
        this.actualText.setText(`Pool instances: ${this.pool.count('turtle')}`)
    }
}

export default ObjectPooling
