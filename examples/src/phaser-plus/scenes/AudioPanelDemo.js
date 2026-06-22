import { Scene, Debugger, AudioPanel, AudioFeature } from '@toolcase/phaser-plus'

function makeDroneBuffer(ctx, hz, durationSec) {
    const sr = ctx.sampleRate
    const n = Math.floor(sr * durationSec)
    const buf = ctx.createBuffer(1, n, sr)
    const data = buf.getChannelData(0)
    const fadeLen = Math.floor(sr * 0.02)
    for (let i = 0; i < n; i++) {
        const env = i < fadeLen ? i / fadeLen :
                    i > n - fadeLen ? (n - i) / fadeLen : 1
        data[i] = Math.sin(2 * Math.PI * hz * i / sr) * env * 0.22
    }
    return buf
}

function makePingBuffer(ctx, hz) {
    const sr = ctx.sampleRate
    const n = Math.floor(sr * 0.18)
    const buf = ctx.createBuffer(1, n, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < n; i++) {
        const t = i / sr
        data[i] = Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * 18) * 0.45
    }
    return buf
}

class AudioMixerDemo extends Scene {

    /** @type {AudioFeature | null} */ audio = null
    /** @type {boolean} */ playingA = true
    /** @type {number} */ emitterX = 0
    /** @type {number} */ emitterDir = 1
    /** @type {number} */ pingTimer = 0
    /** @type {Phaser.GameObjects.Arc | null} */ emitterDot = null
    /** @type {Phaser.GameObjects.Text | null} */ emitterLabel = null
    /** @type {Phaser.GameObjects.Graphics | null} */ connLine = null
    /** @type {Phaser.GameObjects.Text | null} */ statusText = null
    /** @type {Phaser.GameObjects.Text | null} */ crossfadeBtn = null
    /** @type {Phaser.GameObjects.Text | null} */ duckBtn = null

    onInit() {
        const dbg = this.features.register('debugger', Debugger).setExpanded(true)
        dbg.addPanel('audio', AudioPanel, 'Audio')
    }

    onCreate() {
        const { width, height } = this.game.config
        const cx = width / 2
        const cy = height / 2

        if (!this.setupSynthAudio()) {
            this.add.text(cx, cy, 'Web Audio unavailable in this environment', {
                font: '16px Courier', color: '#f87171'
            }).setOrigin(0.5)
            return
        }

        this.audio = this.features.register('audio', AudioFeature)
        this.audio.setListener(cx, cy)
        this.audio.registerSfx('sfx_ping', 8)

        const dbg = this.features.get('debugger')
        if (dbg) this.audio.bindDebugger(dbg)

        this.audio.play('music', 'music_a', true)

        this.emitterX = 60
        this.emitterDir = 1

        this.add.text(cx, 28, 'Audio Mixer — open Debugger > Audio', {
            font: '17px Courier', color: '#c4b5fd'
        }).setOrigin(0.5)

        this.add.text(cx, 54, 'Buses: music / sfx / ui / ambience  ·  spatial ping moves left–right', {
            font: '13px Courier', color: '#94a3b8'
        }).setOrigin(0.5)

        const listenerMark = this.add.text(cx, cy, '✛', {
            font: '22px Courier', color: '#38bdf8'
        }).setOrigin(0.5)
        listenerMark.setDepth(10)

        this.add.text(cx, cy + 18, 'listener', {
            font: '11px Courier', color: '#38bdf8'
        }).setOrigin(0.5)

        this.connLine = this.add.graphics()

        this.emitterDot = this.add.circle(this.emitterX, cy, 10, 0xfbbf24)
        this.emitterDot.setDepth(10)

        this.emitterLabel = this.add.text(this.emitterX, cy + 18, 'emitter', {
            font: '11px Courier', color: '#fbbf24'
        }).setOrigin(0.5).setDepth(10)

        this.statusText = this.add.text(cx, cy + 60, 'playing: music_a', {
            font: '13px Courier', color: '#a3e635'
        }).setOrigin(0.5)

        this.crossfadeBtn = this.add.text(cx - 80, cy + 100, '[ Crossfade → ]', {
            font: '14px Courier', color: '#818cf8',
            backgroundColor: '#1e1b4b', padding: { x: 10, y: 6 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })

        this.crossfadeBtn.on('pointerover', () => this.crossfadeBtn.setColor('#a5b4fc'))
        this.crossfadeBtn.on('pointerout', () => this.crossfadeBtn.setColor('#818cf8'))
        this.crossfadeBtn.on('pointerdown', () => this.doCrossfade())

        this.duckBtn = this.add.text(cx + 80, cy + 100, '[ Duck music ]', {
            font: '14px Courier', color: '#f472b6',
            backgroundColor: '#4a044e', padding: { x: 10, y: 6 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })

        this.duckBtn.on('pointerover', () => this.duckBtn.setColor('#f9a8d4'))
        this.duckBtn.on('pointerout', () => this.duckBtn.setColor('#f472b6'))
        this.duckBtn.on('pointerdown', () => this.audio.duck('music', 0.15, 1200, 600))

        const rangeIndicator = this.add.circle(width / 2, height / 2, 300, 0x0f172a, 0.4)
        rangeIndicator.setStrokeStyle(1, 0x334155)
        rangeIndicator.setDepth(1)

        this.add.text(20, height - 24,
            'Crossfade: 1.2s  ·  Spatial range: 300px  ·  Duck: 1.2s hold + 0.6s restore',
            { font: '12px Courier', color: '#475569' }
        ).setScrollFactor(0)
    }

    setupSynthAudio() {
        const sm = this.sound
        if (!sm.context) return false
        const ctx = sm.context

        this.cache.audio.add('music_a', makeDroneBuffer(ctx, 220, 2))
        this.cache.audio.add('music_b', makeDroneBuffer(ctx, 330, 2))
        this.cache.audio.add('sfx_ping', makePingBuffer(ctx, 880))
        return true
    }

    doCrossfade() {
        if (!this.audio) return
        this.playingA = !this.playingA
        const nextKey = this.playingA ? 'music_a' : 'music_b'
        this.audio.crossfadeTo('music', nextKey, 1200, true)
        const label = this.playingA ? '[ Crossfade → B ]' : '[ Crossfade → A ]'
        this.crossfadeBtn?.setText(label)
    }

    onUpdate(_time, delta) {
        if (!this.audio) return

        const { width, height } = this.game.config
        const range = 300

        this.emitterX += this.emitterDir * delta * 0.18
        if (this.emitterX > width - 60) { this.emitterX = width - 60; this.emitterDir = -1 }
        if (this.emitterX < 60) { this.emitterX = 60; this.emitterDir = 1 }

        const cy = height / 2
        const cx = width / 2

        this.emitterDot?.setPosition(this.emitterX, cy)
        this.emitterLabel?.setPosition(this.emitterX, cy + 18)

        const dx = this.emitterX - cx
        const distance = Math.abs(dx)
        const atten = Math.max(0, 1 - distance / range)
        const pan = Math.max(-1, Math.min(1, dx / range))

        this.connLine?.clear()
        if (atten > 0) {
            this.connLine?.lineStyle(1, 0x4b5563, atten * 0.8)
            this.connLine?.lineBetween(cx, cy, this.emitterX, cy)
        }

        this.pingTimer += delta
        if (this.pingTimer >= 900) {
            this.pingTimer -= 900
            this.audio.playSpatial('sfx', 'sfx_ping', this.emitterX, cy, range)
        }

        this.statusText?.setText(
            `playing: ${this.playingA ? 'music_a' : 'music_b'}` +
            `  |  emitter pan: ${pan.toFixed(2)}  vol: ${atten.toFixed(2)}`
        )
    }

}

export default AudioMixerDemo
