import { Layer, Scene } from '@toolcase/phaser-plus'

class WorldLayer extends Layer {

    onCreate() {
        super.onCreate()
        this.setBackgroundColor('#0d2436')

        const { width, height } = this.game.config
        for (let i = 0; i < 8; i++) {
            const star = this.scene.add.circle(
                Math.random() * width - width / 2,
                Math.random() * height - height / 2,
                3 + Math.random() * 4,
                0xffeb3b
            )
            this.container.add(star)
        }
    }
}

class HUDLayer extends Layer {

    onCreate() {
        super.onCreate()
        this.depth = 100
        this.setBackgroundColor('rgba(0,0,0,0)')

        const { width, height } = this.game.config

        const banner = this.scene.add.rectangle(0, -height / 2 + 40, 800, 60, 0xff5252)
            .setStrokeStyle(3, 0xffffff)
        const text = this.scene.add.text(0, -height / 2 + 40,
            'HUD layer (transparent bg) over World layer (#0d2436)', {
                font: '18px Courier',
                color: '#ffffff'
            }).setOrigin(0.5)

        this.container.add(banner)
        this.container.add(text)
    }
}

class LayerBackground extends Scene {

    onCreate() {
        const { width, height } = this.game.config

        this.features.register('world', WorldLayer)
        this.features.register('hud', HUDLayer)

        this.add.text(0, height / 2 - 60,
            'C = clear world layer (stars vanish; bg color stays)\nB = swap world bg color',
            { font: '16px Courier', color: '#ffffff', align: 'center' }
        ).setOrigin(0.5)

        this.input.keyboard.on('keydown-C', () => {
            this.features.get('world').clear()
        })

        this.input.keyboard.on('keydown-B', () => {
            const colors = ['#0d2436', '#3e1f47', '#1f4734', '#4a2c2a']
            const next = colors[Math.floor(Math.random() * colors.length)]
            this.features.get('world').setBackgroundColor(next)
        })
    }
}

export default LayerBackground
