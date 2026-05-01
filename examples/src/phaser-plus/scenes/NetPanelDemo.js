import { Scene, Debugger } from '@toolcase/phaser-plus'
import { NetPanel } from '@toolcase/phaser-plus'

class NetPanelDemo extends Scene {

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        this.netPanel = dbg.addPanel('net', NetPanel, 'Network')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60,
            'NetPanel — open Debugger > Network', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Simulated RTT, sent/recv, log. Click to send a message.', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)

        // Simulate RTT pings every 500ms
        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                const rtt = 30 + Math.random() * 80
                this.netPanel.reportRTT(rtt)
                if (Math.random() < 0.05) {
                    this.netPanel.reportLoss(Math.random() * 5)
                }
                this.netPanel.received('keepalive')
            }
        })

        this.input.on('pointerdown', () => {
            this.netPanel.sent('move')
        })
    }
}

export default NetPanelDemo
