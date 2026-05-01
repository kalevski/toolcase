import { Scene, Debugger } from '@toolcase/phaser-plus'
import { HotReload } from '@toolcase/phaser-plus'

class HotReloadDemo extends Scene {

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        dbg.addPanel('hotReload', HotReload, 'Hot Reload')
    }

    onCreate() {
        const { width, height } = this.game.config
        const seed = Math.random().toString(36).slice(2, 8)

        this.add.text(width / 2, 60,
            'HotReload — open Debugger > Hot Reload', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Click "Reload scene". Random seed below changes — confirms re-init.', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)

        this.add.text(width / 2, height / 2, `seed = ${seed}`, {
            font: '32px Courier',
            color: '#80cbc4'
        }).setOrigin(0.5)

        const passedCount = this.payload?.count ?? 0
        this.add.text(width / 2, height / 2 + 50,
            `payload.count = ${passedCount} (toggle "Keep payload" then reload)`, {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)

        // On every reload, increment count to demonstrate payload preservation
        if (this.payload) this.payload.count = passedCount + 1
    }
}

export default HotReloadDemo
