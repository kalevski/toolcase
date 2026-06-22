import { Scene, ParticleFeature, HeatEffect, PARTICLE_BURST } from '@toolcase/phaser-plus'

const PRESETS = ['sparkle', 'fire', 'confetti', 'explosion']
const LABELS  = ['Sparkle', 'Fire', 'Confetti', 'Explosion (+ HeatEffect)']

class ParticleFeatureDemo extends Scene {

    /** @type {ParticleFeature|null} */ particles = null
    /** @type {import('@toolcase/phaser-plus').StreamHandle|null} */ streamHandle = null
    /** @type {Phaser.GameObjects.Zone|null} */ cursorZone = null
    /** @type {Phaser.GameObjects.Text[]} */ presetBtns = []
    /** @type {Phaser.GameObjects.Text|null} */ streamBtn = null
    /** @type {Phaser.GameObjects.Text|null} */ infoLabel = null
    selected = 'sparkle'

    onCreate() {
        const { width, height } = this.game.config

        this.cameras.main.setBackgroundColor('#0f172a')

        const g = this.add.graphics()
        const tileW = 40
        const cols = Math.ceil(width / tileW) + 1
        const rows = Math.ceil(height / tileW) + 1
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const col = (r + c) % 2 === 0 ? 0x1e293b : 0x0f172a
                g.fillStyle(col, 1)
                g.fillRect(c * tileW, r * tileW, tileW, tileW)
            }
        }
        g.generateTexture('vfx-checker', width, height)
        g.destroy()

        const checker = this.add.image(width / 2, height / 2, 'vfx-checker')

        const dot = this.add.graphics()
        dot.fillStyle(0xffffff, 1)
        dot.fillCircle(8, 8, 8)
        dot.generateTexture('vfx-dot', 16, 16)
        dot.destroy()

        this.particles = this.features.register('vfx', ParticleFeature)
        this.particles.setEffectTarget(checker)

        this.particles.define('sparkle', {
            texture: 'vfx-dot',
            lifespan: 600,
            quantity: 25,
            speed: { min: 40, max: 130 },
            scale: { start: 0.45, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [0xffd700, 0xffffff, 0x00e5ff],
            angle: { min: 0, max: 360 }
        })

        this.particles.define('fire', {
            texture: 'vfx-dot',
            lifespan: 900,
            quantity: 30,
            speed: { min: 50, max: 160 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.9, end: 0 },
            tint: [0xff6b00, 0xff3700, 0xffaa00],
            angle: { min: 255, max: 285 },
            gravityY: -80
        })

        this.particles.define('confetti', {
            texture: 'vfx-dot',
            lifespan: 1400,
            quantity: 45,
            speed: { min: 80, max: 210 },
            scale: { start: 0.5, end: 0.05 },
            alpha: { start: 1, end: 0.1 },
            tint: [0xff0055, 0x00e5ff, 0xffcc00, 0x00ff88, 0xff6600],
            angle: { min: 0, max: 360 },
            gravityY: 140
        })

        this.particles.define('explosion', {
            texture: 'vfx-dot',
            lifespan: 900,
            quantity: 60,
            speed: { min: 100, max: 300 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [0xffa500, 0xff4400, 0xffdd00],
            angle: { min: 0, max: 360 },
            effect: HeatEffect,
            effectDuration: 1400
        })

        this.cursorZone = this.add.zone(width / 2, height / 2, 1, 1)

        this.input.on('pointermove', (p) => {
            this.cursorZone.x = p.x
            this.cursorZone.y = p.y
        })

        this.input.on('pointerdown', (p) => {
            if (p.y > height - 100) return
            if (this.streamHandle !== null) return
            this.particles.burst(this.selected, p.x, p.y)
        })

        this.features.on(PARTICLE_BURST, (name, x, y) => {
            if (this.infoLabel !== null) {
                this.infoLabel.setText(`burst: ${name}  (${Math.round(x)}, ${Math.round(y)})`)
            }
        })

        this.buildUI(width, height)
    }

    /** @param {number} width @param {number} height */
    buildUI(width, height) {
        const btnY = height - 68
        const btnW = 210
        const gap  = 10
        const totalW = PRESETS.length * (btnW + gap) - gap
        const startX = (width - totalW) / 2

        this.presetBtns = PRESETS.map((key, i) => {
            const x = startX + i * (btnW + gap) + btnW / 2
            const isSelected = key === this.selected
            const btn = this.add.text(x, btnY, LABELS[i], {
                font: '12px JetBrains Mono, monospace',
                color: isSelected ? '#38bdf8' : '#94a3b8',
                backgroundColor: '#1e293b',
                padding: { x: 12, y: 8 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true })

            btn.on('pointerover', () => {
                if (PRESETS[i] !== this.selected) btn.setColor('#f8fafc')
            })
            btn.on('pointerout', () => {
                btn.setColor(PRESETS[i] === this.selected ? '#38bdf8' : '#94a3b8')
            })
            btn.on('pointerdown', () => {
                this.selected = PRESETS[i]
                this.presetBtns.forEach((b, j) => {
                    b.setColor(PRESETS[j] === this.selected ? '#38bdf8' : '#94a3b8')
                })
            })
            return btn
        })

        const streamX = startX + PRESETS.length * (btnW + gap) + 10 + 80
        this.streamBtn = this.add.text(streamX, btnY, '▶ STREAM', {
            font: '12px JetBrains Mono, monospace',
            color: '#a3e635',
            backgroundColor: '#1a2e0f',
            padding: { x: 12, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })

        this.streamBtn.on('pointerdown', () => {
            if (this.streamHandle !== null) {
                this.streamHandle.stop()
                this.streamHandle = null
                this.streamBtn.setText('▶ STREAM').setColor('#a3e635')
            } else {
                this.streamHandle = this.particles.stream('sparkle', this.cursorZone)
                this.streamBtn.setText('■ STOP').setColor('#f87171')
            }
        })

        this.infoLabel = this.add.text(width / 2, height - 28,
            'click canvas to burst • move mouse to track cursor • select preset below',
            { font: '11px JetBrains Mono, monospace', color: '#475569' }
        ).setOrigin(0.5)

        this.add.text(20, 20, 'ParticleFeature — VFX Gallery', {
            font: '16px JetBrains Mono, monospace', color: '#f8fafc'
        })

        this.add.text(20, 44,
            '"Explosion" also applies HeatEffect to the checkerboard background for effectDuration ms.',
            { font: '11px JetBrains Mono, monospace', color: '#475569' }
        )
    }

    onDestroy() {
        if (this.streamHandle !== null) {
            this.streamHandle.stop()
            this.streamHandle = null
        }
    }

}

export default ParticleFeatureDemo
