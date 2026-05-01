import { Scene, ParallaxLayer } from '@toolcase/phaser-plus'
import { Input } from 'phaser'

class ParallaxLayerDemo extends Scene {

    /** @type {ParallaxLayer} */ farLayer = null
    /** @type {ParallaxLayer} */ midLayer = null
    /** @type {ParallaxLayer} */ nearLayer = null
    keys = { left: null, right: null, up: null, down: null }

    onCreate() {
        const { width, height } = this.game.config

        this.cameras.main.setBackgroundColor('#0f172a')

        this.farLayer = this.features.register('bg-far', ParallaxLayer)
        this.midLayer = this.features.register('bg-mid', ParallaxLayer)
        this.nearLayer = this.features.register('bg-near', ParallaxLayer)

        this.farLayer.setFactor(0.1).depth = 0
        this.midLayer.setFactor(0.4).depth = 1
        this.nearLayer.setFactor(0.9).depth = 2

        this.scatter(this.farLayer, 0x334155, 4)
        this.scatter(this.midLayer, 0x64748b, 12)
        this.scatter(this.nearLayer, 0xcbd5e1, 22)

        const codes = Input.Keyboard.KeyCodes
        const kb = this.input.keyboard
        this.keys.left = kb.addKey(codes.LEFT)
        this.keys.right = kb.addKey(codes.RIGHT)
        this.keys.up = kb.addKey(codes.UP)
        this.keys.down = kb.addKey(codes.DOWN)

        this.add.text(20, 20,
            'Arrows: move main camera. Layers parallax.',
            { color: '#fff', fontSize: '18px' }
        ).setScrollFactor(0)
        this.add.text(20, 50,
            'far x0.1 • mid x0.4 • near x0.9',
            { color: '#94a3b8', fontSize: '14px' }
        ).setScrollFactor(0)

        // unused but suppress
        void width; void height
    }

    /**
     * @param {ParallaxLayer} layer
     * @param {number} color
     * @param {number} radius
     */
    scatter(layer, color, radius) {
        const { width, height } = this.game.config
        for (let i = 0; i < 60; i++) {
            const x = (Math.random() - 0.5) * width * 4
            const y = (Math.random() - 0.5) * height * 4
            const dot = this.add.circle(x, y, radius, color)
            layer.container.add(dot)
        }
    }

    onUpdate(_t, delta) {
        const cam = this.cameras.main
        const speed = 0.4 * delta
        if (this.keys.left.isDown) cam.scrollX -= speed
        if (this.keys.right.isDown) cam.scrollX += speed
        if (this.keys.up.isDown) cam.scrollY -= speed
        if (this.keys.down.isDown) cam.scrollY += speed
    }

}

export default ParallaxLayerDemo
