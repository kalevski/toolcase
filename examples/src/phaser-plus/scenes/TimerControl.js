import { Flow, Scene } from '@toolcase/phaser-plus'

class Tick extends Flow.TimeEvent {

    onFire(times) {
        this.scene.features.emit('tick', times)
    }
}

class TimerControl extends Scene {

    label = null

    statusText = null

    paused = false

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60, 'Flow.timer pause / resume / reset', {
            font: '20px Courier',
            color: '#ff8a65'
        }).setOrigin(0.5, 0)

        this.label = this.add.text(width / 2, height / 2 - 40, '', {
            font: '32px Courier',
            color: '#ffffff'
        }).setOrigin(0.5)

        this.statusText = this.add.text(width / 2, height / 2 + 40, '', {
            font: '18px Courier',
            color: '#ff8a65'
        }).setOrigin(0.5)

        this.add.text(width / 2, height - 80,
            'P = pause/resume   R = reset (counter back to 0)', {
                font: '16px Courier',
                color: '#aaaaaa'
            }).setOrigin(0.5)

        this.flow.timer.add('tick', Tick, 0.5, 0)

        this.features.on('tick', (n) => {
            this.label.setText(`tick #${n}`)
        }, this)

        this.refresh()

        this.input.keyboard.on('keydown-P', () => {
            this.paused = !this.paused
            if (this.paused) {
                this.flow.timer.pause('tick')
            } else {
                this.flow.timer.resume('tick')
            }
            this.refresh()
        })

        this.input.keyboard.on('keydown-R', () => {
            this.flow.timer.reset('tick', 0)
            this.label.setText('tick #0')
            this.refresh()
        })
    }

    refresh() {
        this.statusText.setText(this.paused ? '[paused]' : '[running]')
    }
}

export default TimerControl
