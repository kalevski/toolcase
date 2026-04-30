import { Debugger, Scene } from '@toolcase/phaser-plus'

class GameStatsPanel extends Debugger.Panel {

    state = {
        coins: 0,
        speed: 1,
        message: 'idle'
    }

    components = {
        coins: null,
        speed: null,
        message: null,
        addCoins: null
    }

    draw() {
        this.components.coins = this.base.addInput(this.state, 'coins', {
            label: 'Coins',
            disabled: true,
            step: 1
        })

        this.components.speed = this.base.addInput(this.state, 'speed', {
            label: 'Speed multiplier',
            min: 0.1,
            max: 5
        })

        this.components.message = this.base.addInput(this.state, 'message', {
            label: 'Message'
        })

        this.base.addSeparator()

        this.components.addCoins = this.base.addButton({ title: '+100 coins' })
            .on('click', () => {
                this.state.coins += 100
                this.refresh()
            })
    }

    doUpdate() {
        this.refresh()
    }

    refresh() {
        for (let key in this.components) {
            const c = this.components[key]
            if (c && typeof c.refresh === 'function') c.refresh()
        }
    }
}

class CustomDebugPanel extends Scene {

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        dbg.addPanel('gameStats', GameStatsPanel, 'Game Stats')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.image(width / 2, height / 2, 'objects', 'turtle_left')
        this.add.text(width / 2, height / 2 + 200,
            'Open Debugger -> Game Stats panel (custom Tweakpane panel via addPanel)', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)
    }
}

export default CustomDebugPanel
