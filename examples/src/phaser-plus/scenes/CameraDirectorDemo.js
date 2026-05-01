import { Scene, CameraDirector, EASE_IN_OUT, SHOT_DONE } from '@toolcase/phaser-plus'
import { Input } from 'phaser'

class CameraDirectorDemo extends Scene {

    /** @type {CameraDirector} */ director = null
    /** @type {Phaser.GameObjects.Arc} */ target = null
    /** @type {Phaser.GameObjects.Text} */ label = null

    onCreate() {
        const g = this.add.graphics()
        g.lineStyle(1, 0x334155, 0.8)
        for (let x = -2000; x <= 2000; x += 80) {
            g.beginPath(); g.moveTo(x, -2000); g.lineTo(x, 2000); g.strokePath()
        }
        for (let y = -2000; y <= 2000; y += 80) {
            g.beginPath(); g.moveTo(-2000, y); g.lineTo(2000, y); g.strokePath()
        }

        this.add.rectangle(-400, -300, 200, 200, 0x60a5fa)
        this.add.rectangle(400, -300, 200, 200, 0xf472b6)
        this.add.rectangle(0, 400, 240, 120, 0x4ade80)

        this.target = this.add.circle(0, 0, 18, 0xfbbf24)

        this.label = this.add.text(20, 20, 'press 1–4 to queue shots', { color: '#fff', fontSize: '18px' })
            .setScrollFactor(0)
        this.add.text(20, 50,
            '1: pan • 2: zoom • 3: fit-bounds • 4: follow target • 5: spline',
            { color: '#94a3b8', fontSize: '14px' }
        ).setScrollFactor(0)

        this.director = this.features.register('camera', CameraDirector)

        this.features.on(SHOT_DONE, shot => this.label.setText(`done: ${shot.type}`))

        const codes = Input.Keyboard.KeyCodes
        const kb = this.input.keyboard
        kb.addKey(codes.ONE).on('down', () =>
            this.director.cut({ type: 'pan', x: -400, y: -300, duration: 1.5, ease: EASE_IN_OUT }))
        kb.addKey(codes.TWO).on('down', () =>
            this.director.push({ type: 'zoom', zoom: 2, duration: 1, ease: EASE_IN_OUT }))
        kb.addKey(codes.THREE).on('down', () =>
            this.director.cut({ type: 'fit-bounds', x: -500, y: -400, width: 1000, height: 800, duration: 1.5, padding: 40 }))
        kb.addKey(codes.FOUR).on('down', () =>
            this.director.cut({ type: 'follow', target: this.target, lerp: 0.08 }))
        kb.addKey(codes.FIVE).on('down', () =>
            this.director.cut({ type: 'spline', duration: 6, loop: true, points: [
                { x: -400, y: -300 }, { x: 400, y: -300 },
                { x: 400, y: 300 }, { x: -400, y: 300 }, { x: -400, y: -300 }
            ] }))
    }

    onUpdate(_t, delta) {
        const t = this.time.now / 1000
        this.target.x = Math.cos(t) * 200
        this.target.y = Math.sin(t * 1.3) * 150
        // delta unused; suppress lint
        void delta
    }

}

export default CameraDirectorDemo
