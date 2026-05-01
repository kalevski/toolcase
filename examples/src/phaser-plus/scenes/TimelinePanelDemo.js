import { Scene, Debugger, Flow } from '@toolcase/phaser-plus'
import { TimelinePanel } from '@toolcase/phaser-plus'

class HeartbeatEvent extends Flow.Event {}
class SpawnEvent extends Flow.Event {}

class TimelinePanelDemo extends Scene {

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        dbg.addPanel('timeline', TimelinePanel, 'Timeline')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60,
            'TimelinePanel — open Debugger > Timeline', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Toggle Paused / Step. Click to fire SpawnEvent. Heartbeat fires every 2s.', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)

        this.flow.events.register(HeartbeatEvent, () => { /* logged by timeline */ })
        this.flow.events.register(SpawnEvent, () => { /* logged by timeline */ })

        this.flow.timer.set(() => {
            this.flow.events.trigger(HeartbeatEvent)
        }, 2, true)

        this.input.on('pointerdown', () => {
            this.flow.events.trigger(SpawnEvent)
        })
    }
}

export default TimelinePanelDemo
