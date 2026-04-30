import { GameObject, Scene } from '@toolcase/phaser-plus'
import { Math as M } from 'phaser'

class Marker extends GameObject {

    label = null

    title = ''

    out = new M.Vector2()

    setLabel(text, color) {
        this.title = text
        this.scene.add.existing(this)
        const dot = this.scene.add.circle(0, 0, 8, color)
        this.label = this.scene.add.text(12, -10, '', {
            font: '16px Courier',
            color: '#ffffff'
        })
        this.add(dot)
        this.add(this.label)
        return this
    }

    refresh() {
        this.getAbsolute(this.out)
        this.label.setText(`${this.title} :: abs(${this.out.x | 0}, ${this.out.y | 0})`)
    }
}

class AbsolutePosition extends Scene {

    inner = null

    middle = null

    outer = null

    onCreate() {
        const { width } = this.game.config

        this.add.text(width / 2, 40, 'GameObject.getAbsolute(out) walks parentContainer chain', {
            font: '20px Courier',
            color: '#4fc3f7'
        }).setOrigin(0.5, 0)

        this.outer = new Marker(this, 0, 0).setLabel('outer', 0xff5252)
        this.outer.setPosition(300, 300)

        this.middle = new Marker(this, 0, 0).setLabel('middle', 0xffeb3b)
        this.middle.setPosition(150, 80)
        this.outer.add(this.middle)

        this.inner = new Marker(this, 0, 0).setLabel('inner', 0x69f0ae)
        this.inner.setPosition(50, 40)
        this.middle.add(this.inner)
    }

    onUpdate(time) {
        const wave = Math.sin(time / 500) * 80
        this.outer.x = 300 + wave
        this.outer.refresh()
        this.middle.refresh()
        this.inner.refresh()
    }
}

export default AbsolutePosition
