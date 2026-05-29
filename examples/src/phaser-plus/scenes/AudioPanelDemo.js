import { Scene, Debugger } from '@toolcase/phaser-plus'
import { AudioPanel } from '@toolcase/phaser-plus'

class AudioPanelDemo extends Scene {

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded()
        const audio = dbg.addPanel('audio', AudioPanel, 'Audio')

        // Demo buses — app would route SFX/Music through these
        this.busSfx = audio.addBus('sfx', (bus) => {
            console.log('[sfx bus]', bus.volume, 'mute=', bus.mute, 'pan=', bus.pan)
        })
        this.busMusic = audio.addBus('music', (bus) => {
            console.log('[music bus]', bus.volume, 'mute=', bus.mute, 'pan=', bus.pan)
        })

        // Mix multiple channels into one music control — bus vol/mute/pan
        // applies to every routed sound key.
        audio.addChannel('music', 'music_layer_drums', 'music_layer_melody')
        audio.addChannel('sfx', 'sfx_jump', 'sfx_coin')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60,
            'AudioPanel — open Debugger > Audio', {
                font: '18px Courier',
                color: '#ce93d8'
            }).setOrigin(0.5)

        this.add.text(width / 2, 100,
            'Adjust Master vol/mute/pan and per-bus vol/mute/pan sliders. Open console for change events.', {
                font: '14px Courier',
                color: '#aaa'
            }).setOrigin(0.5)

        // Show currently playing tracks. No real audio loaded — Playing stays "(none)".
    }
}

export default AudioPanelDemo
