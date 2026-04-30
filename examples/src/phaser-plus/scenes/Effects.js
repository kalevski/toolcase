import { GameObject, Scene, EFFECT_REGISTRY, Debugger } from '@toolcase/phaser-plus'

class Showpiece extends GameObject {

    base = null

    onCreate() {
        this.base = this.scene.add.sprite(0, 0, 'objects', 'turtle_left')
        this.add(this.base)
    }
}

class Effects extends Scene {

    /** @type {Showpiece} */
    showpiece = null

    /** @type {import('@toolcase/phaser-plus').Effect | null} */
    current = null

    label = null

    indexLabel = null

    /** @type {Array} */
    effectClasses = EFFECT_REGISTRY

    index = 0

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onInit() {
        this.features.register('debugger', Debugger)
    }

    onCreate() {
        const { width, height } = this.game.config
        this.cameras.main.setBackgroundColor('#1c1c1c')

        this.pool.register('showpiece', Showpiece)
        this.showpiece = this.pool.obtain('showpiece')
        this.showpiece.setPosition(width / 2, height / 2)
        this.showpiece.setScale(1)
        this.add.existing(this.showpiece)

        this.label = this.add.text(width / 2, 80, '', {
            font: '28px Courier',
            color: '#03dac6'
        }).setOrigin(0.5)

        this.indexLabel = this.add.text(width / 2, height - 80,
            'UP / DOWN to cycle effects   SPACE to clear   B for blank baseline', {
                font: '16px Courier',
                color: '#aaaaaa'
            }).setOrigin(0.5)

        this.applyEffect(0)

        this.input.keyboard.on('keydown-UP', () => {
            this.applyEffect((this.index - 1 + this.effectClasses.length) % this.effectClasses.length)
        })
        this.input.keyboard.on('keydown-DOWN', () => {
            this.applyEffect((this.index + 1) % this.effectClasses.length)
        })
        this.input.keyboard.on('keydown-SPACE', () => {
            this.showpiece.effects.clear()
            this.current = null
            this.label.setText('— no effect —')
        })
        this.input.keyboard.on('keydown-B', () => {
            this.showpiece.effects.clear()
            this.current = null
            this.label.setText('baseline (no effect)')
        })
    }

    /** @param {number} idx */
    applyEffect(idx) {
        this.index = idx
        this.showpiece.effects.clear()
        const E = this.effectClasses[idx]
        this.current = this.showpiece.effects.add(E)
        const name = E.KEY.replace(/^reef\./, '')
        this.label.setText(`[${idx + 1} / ${this.effectClasses.length}]  ${name}`)
    }
}

export default Effects
