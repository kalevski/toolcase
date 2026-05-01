import { Scene, Debugger } from '@toolcase/phaser-plus'
import { RemoteDebugger, PerformancePanel } from '@toolcase/phaser-plus'

class RemoteDebuggerDemo extends Scene {

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        const perf = dbg.addPanel('perf', PerformancePanel, 'Performance')
        const remote = dbg.addPanel('remote', RemoteDebugger, 'Remote')

        // Forward perf snapshot to whatever WS is connected
        remote.setSnapshotProvider(() => ({
            fps: perf.state.fps,
            frameMs: perf.state.frameMs,
            drawCalls: perf.state.drawCalls,
            objects: this.children.list.length
        }))

        // Inbound command example: remote can ping us
        remote.onRemote('ping', (payload) => {
            console.log('[remote ping]', payload)
            remote.send('pong', { t: Date.now() })
        })
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60,
            'RemoteDebugger — open Debugger > Remote', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Set WS URL (e.g. ws://localhost:9099) and click Connect.', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)

        this.add.text(width / 2, 130,
            'Snapshots include perf state. Inbound "ping" replies with "pong".', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)
    }
}

export default RemoteDebuggerDemo
