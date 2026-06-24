import {
    Scene,
    Debugger,
    NetPanel,
    NetFeature,
    LoopbackTransport,
    NET_ENTITY_STATE
} from '@toolcase/phaser-plus'

/**
 * NetFeature loopback demo.
 *
 * Two NetFeature instances (client + server) are joined by a LoopbackTransport
 * pair with 50 ms one-way latency (~100 ms RTT).  Arrow keys move the blue
 * (local / predicted) square; the green square shows the position as received
 * on the server side after the transport round-trip.  NetPanel shows real RTT,
 * loss %, and sent/recv rates driven entirely by NetFeature.
 */
class NetLoopbackDemo extends Scene {

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        this.netPanel = dbg.addPanel('net', NetPanel, 'Network')

        // 50 ms one-way latency, ±10 ms jitter → ~100 ms RTT visible in panel
        const [clientTransport, serverTransport] = LoopbackTransport.pair(50, 10)

        this.netClient = this.features.register('net-client', NetFeature)
        this.netClient.setTransport(clientTransport)
        this.netClient.bindDebugger(dbg)

        this.netServer = this.features.register('net-server', NetFeature)
        this.netServer.setTransport(serverTransport)
    }

    onCreate() {
        const { width, height } = this.game.config
        const cx = width / 2
        const cy = height / 2

        // Local (predicted) entity — moves immediately with input
        this.localRect = this.add.rectangle(cx, cy, 44, 44, 0x4fc3f7)

        // Remote entity — driven by what the server received over the transport
        this.remoteRect = this.add.rectangle(cx + 60, cy, 44, 44, 0x81c784).setAlpha(0.75)

        this.add.text(cx, 28,
            'Blue = local (immediate)   Green = server-received (~100 ms behind)',
            { font: '13px Courier', color: '#aaa' }
        ).setOrigin(0.5)

        this.add.text(cx, 54,
            'Arrow keys to move   |   Open Debugger > Network for live telemetry',
            { font: '13px Courier', color: '#666' }
        ).setOrigin(0.5)

        this.cursors = this.input.keyboard.createCursorKeys()

        // Connect — LoopbackTransport.connect() brings up both ends simultaneously
        this.netClient.connect()

        // Listen for state updates arriving on the server side
        this.features.on(NET_ENTITY_STATE, (id, state) => {
            if (id === 'player') {
                this.remoteRect.x = state.x
                this.remoteRect.y = state.y
            }
        })
    }

    onUpdate(_time, _delta) {
        const speed = 3
        const { left, right, up, down } = this.cursors

        if (left.isDown)  this.localRect.x -= speed
        if (right.isDown) this.localRect.x += speed
        if (up.isDown)    this.localRect.y -= speed
        if (down.isDown)  this.localRect.y += speed

        // Sync local position to the server side every frame (delta-encoded)
        this.netClient.syncEntity('player', {
            x: this.localRect.x,
            y: this.localRect.y
        })
    }
}

export default NetLoopbackDemo
