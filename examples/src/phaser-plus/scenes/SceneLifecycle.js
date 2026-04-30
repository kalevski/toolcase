import { Scene } from '@toolcase/phaser-plus'

class SceneLifecycle extends Scene {

    rotator = null

    label = null

    counter = 0

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.counter = (this.payload && typeof this.payload.count === 'number') ? this.payload.count : 0

        this.rotator = this.add.image(width / 2, height / 2, 'objects', 'circle_green')

        this.label = this.add.text(width / 2, height / 2 + 200, '', {
            font: '24px Courier',
            color: '#00ff88'
        }).setOrigin(0.5)

        this.refresh()

        this.input.keyboard.on('keydown-R', () => {
            this.restart({ count: this.counter + 1 })
        })
    }

    onUpdate(time, delta) {
        if (this.rotator !== null) {
            this.rotator.angle += 0.1 * delta
        }
    }

    refresh() {
        this.label.setText(
            `Restart count: ${this.counter}\n` +
            `Sprite rotated by Scene.onUpdate\n` +
            `Press R to restart with payload.count + 1`
        )
    }
}

export default SceneLifecycle
