import { Scene, Debugger } from '@toolcase/phaser-plus'
import { PerformancePanel } from '@toolcase/phaser-plus'

class PerformancePanelDemo extends Scene {

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        dbg.addPanel('perf', PerformancePanel, 'Performance')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60,
            'PerformancePanel — open Debugger > Performance', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Click to spawn 200 sprites and watch FPS / Frame ms graphs', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)

        this.input.on('pointerdown', () => {
            for (let i = 0; i < 200; i++) {
                const x = Math.random() * width
                const y = Math.random() * height
                this.add.image(x, y, 'objects', 'turtle_left').setScale(0.5)
            }
        })

        // Force a long frame periodically to test GC pause counter
        this.time.addEvent({
            delay: 5000,
            loop: true,
            callback: () => {
                const t0 = performance.now()
                while (performance.now() - t0 < 70) { /* spin to simulate stall */ }
            }
        })
    }
}

export default PerformancePanelDemo
