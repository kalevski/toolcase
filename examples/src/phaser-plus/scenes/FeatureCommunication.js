import { Feature, Scene } from '@toolcase/phaser-plus'

const PING = 'ping'
const PONG = 'pong'

class Pinger extends Feature {

    counter = 0

    onCreate() {
        this.scene.features.on(PONG, this.onPong, this)
    }

    onUpdate(time, delta) {
        this.counter += delta
        if (this.counter >= 1000) {
            this.counter = 0
            this.emit(PING, { from: 'pinger', at: time | 0 })
        }
    }

    /** @private */
    onPong(payload) {
        this.logger.info('received pong', payload)
        this.scene.features.emit('log', `pinger got pong (${payload.at})`)
    }

    onDestroy() {
        this.scene.features.off(PONG, this.onPong, this)
    }
}

class Ponger extends Feature {

    onCreate() {
        this.scene.features.on(PING, this.onPing, this)
    }

    /** @private */
    onPing(payload) {
        this.scene.features.emit('log', `ponger got ping (${payload.at})`)
        this.emit(PONG, { from: 'ponger', at: payload.at })
    }

    onDestroy() {
        this.scene.features.off(PING, this.onPing, this)
    }
}

class FeatureCommunication extends Scene {

    label = null

    history = []

    onCreate() {
        const { width, height } = this.game.config

        this.label = this.add.text(width / 2, 60, 'Feature pub-sub via FeatureRegistry', {
            font: '20px Courier',
            color: '#7c4dff'
        }).setOrigin(0.5, 0)

        this.history = []
        this.logText = this.add.text(width / 2, height / 2, '', {
            font: '18px Courier',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5)

        this.features.on('log', this.append, this)
        this.features.register('pinger', Pinger)
        this.features.register('ponger', Ponger)
    }

    /** @private */
    append(line) {
        this.history.push(line)
        if (this.history.length > 12) {
            this.history.shift()
        }
        this.logText.setText(this.history.join('\n'))
    }
}

export default FeatureCommunication
