import {
    Scene,
    CameraDirector,
    ScreenShake,
    CameraFlash,
    ParallaxLayer,
    LetterboxFeature,
    DialogCameraCue,
    HTMLFeature,
    SHOT_DONE,
    EASE_IN_OUT,
    EASE_OUT
} from '@toolcase/phaser-plus'

/**
 * Cinema subsystem landing demo.
 *
 * Presents the full Cinema surface in one scene:
 *   CameraDirector  — queued shots: pan, zoom, fit-bounds, follow, spline
 *   ScreenShake     — trauma-based stacking shake (impact / rumble / sine)
 *   CameraFlash     — fullscreen color overlay (white hit, red damage)
 *   ParallaxLayer   — depth-scrolling background layers at different factors
 *   LetterboxFeature — toggle cinematic letterbox bars
 *   DialogCameraCue — focus/dim frame for NPC or cutscene moments
 *
 * Use the panel buttons on the right to trigger each cinema system.
 */

const PANEL_W = 210

const BTN = `
    display:block; width:100%; padding:7px 12px; margin-bottom:5px; cursor:pointer;
    background:#1e293b; color:#cbd5e1; border:1px solid #334155;
    font-family:'JetBrains Mono',monospace; font-size:11px;
    text-transform:uppercase; letter-spacing:0.05em; text-align:left;
`

const SECT = `
    font-family:'JetBrains Mono',monospace; font-size:9px; color:#475569;
    text-transform:uppercase; letter-spacing:0.1em; margin:12px 0 5px;
`

class CinemaPanel extends HTMLFeature {
    /** @type {HTMLElement|null} */ statusEl = null

    onCreate() {
        this.node.innerHTML = `
        <div style="
            position:absolute; top:0; right:0; width:${PANEL_W}px; height:100%;
            background:rgba(10,14,23,0.95); border-left:1px solid #1e293b;
            overflow-y:auto; box-sizing:border-box; padding:12px 14px;
        ">
            <div style="color:#f472b6; font-size:12px; font-family:'JetBrains Mono',monospace;
                        border-bottom:1px solid #1e293b; padding-bottom:10px; margin-bottom:2px;">
                Cinema
            </div>

            <div style="${SECT}">Camera Director</div>
            <button data-a="shot-pan"    style="${BTN}">Shot: pan left</button>
            <button data-a="shot-zoom"   style="${BTN}">Shot: zoom ×2</button>
            <button data-a="shot-fit"    style="${BTN}">Shot: fit bounds</button>
            <button data-a="shot-follow" style="${BTN}">Shot: follow target</button>
            <button data-a="shot-spline" style="${BTN}">Shot: spline orbit</button>
            <button data-a="shot-skip"   style="${BTN}">Skip current shot</button>
            <div data-r="shot" style="font-family:'JetBrains Mono',monospace;
                font-size:11px; color:#94a3b8; margin-bottom:4px;">—</div>

            <div style="${SECT}">Screen Shake</div>
            <button data-a="shake-impact" style="${BTN}">Impact (0.8)</button>
            <button data-a="shake-rumble" style="${BTN}">Rumble 1 s</button>
            <button data-a="shake-sine"   style="${BTN}">Sine 12 Hz</button>

            <div style="${SECT}">Camera Flash</div>
            <button data-a="flash-white" style="${BTN}">White flash (0.25 s)</button>
            <button data-a="flash-red"   style="${BTN}">Red damage flash</button>

            <div style="${SECT}">Letterbox</div>
            <button data-a="letterbox-toggle" style="${BTN}">Toggle 21:9 bars</button>
            <div data-r="letterbox" style="font-family:'JetBrains Mono',monospace;
                font-size:11px; color:#94a3b8; margin-bottom:4px;">off</div>

            <div style="${SECT}">Dialog Cue</div>
            <button data-a="cue-open"  style="${BTN}">Focus NPC frame</button>
            <button data-a="cue-close" style="${BTN}">Clear cue</button>
        </div>`

        this.node.querySelectorAll('[data-a]').forEach(btn =>
            btn.addEventListener('click', () => this.scene.handleAction(btn.dataset.a))
        )
        this.statusEl = this.node.querySelector('[data-r="shot"]')
        this._readouts = {}
        this.node.querySelectorAll('[data-r]').forEach(el => {
            this._readouts[el.dataset.r] = el
        })
    }

    set(key, text) {
        if (this._readouts?.[key]) this._readouts[key].textContent = text
    }
}

class CinemaLandingDemo extends Scene {
    /** @type {CinemaPanel|null} */       panel     = null
    /** @type {CameraDirector|null} */    director  = null
    /** @type {ScreenShake|null} */       shake     = null
    /** @type {CameraFlash|null} */       flash     = null
    /** @type {LetterboxFeature|null} */  letterbox = null
    /** @type {DialogCameraCue|null} */   cue       = null
    /** @type {Phaser.GameObjects.Arc|null} */ target = null
    /** @type {boolean} */ letterboxOn = false

    onCreate() {
        const { width, height } = this.game.config

        // ── Parallax background layers ────────────────────────────────────────
        // Far layer: scattered dots (stars / distant scenery)
        const far = this.features.register('far', ParallaxLayer)
        far.setFactor(0.1).setReference(this.cameras.main)
        far.depth = 0
        const farG = this.add.graphics()
        farG.fillStyle(0x1e293b, 1)
        for (let i = 0; i < 60; i++) {
            const x = (Math.random() - 0.5) * 3000
            const y = (Math.random() - 0.5) * 2000
            farG.fillRect(x, y, 2, 2)
        }
        far.container.add(farG)

        // Mid layer: horizontal bands (distant hills)
        const mid = this.features.register('mid', ParallaxLayer)
        mid.setFactor(0.4).setReference(this.cameras.main)
        mid.depth = 1
        const midG = this.add.graphics()
        midG.fillStyle(0x0f172a, 1)
        midG.fillRect(-2000, 80, 4000, 60)
        midG.fillStyle(0x1e293b, 1)
        midG.fillRect(-2000, 100, 4000, 40)
        mid.container.add(midG)

        // Near layer: foreground elements
        const near = this.features.register('near', ParallaxLayer)
        near.setFactor(0.75).setReference(this.cameras.main)
        near.depth = 2
        const nearG = this.add.graphics()
        nearG.fillStyle(0x334155, 1)
        for (let x = -2000; x <= 2000; x += 200) {
            const h = 30 + Math.random() * 60
            nearG.fillRect(x, height / 2 + 40 - h, 20, h)
        }
        near.container.add(nearG)

        // ── World content ─────────────────────────────────────────────────────
        this.add.rectangle(0, 0, width * 6, height * 4, 0x0a0e17)

        // Grid
        const grid = this.add.graphics()
        grid.lineStyle(1, 0x1e293b, 0.6)
        for (let x = -2000; x <= 2000; x += 100) {
            grid.lineBetween(x, -1500, x, 1500)
        }
        for (let y = -1500; y <= 1500; y += 100) {
            grid.lineBetween(-2000, y, 2000, y)
        }

        // Landmark rectangles for camera shots to reference
        this.add.rectangle(-500, -300, 120, 120, 0x3b82f6).setDepth(3)
        this.add.rectangle(500, -300, 120, 120, 0xec4899).setDepth(3)
        this.add.rectangle(0, 300, 180, 80, 0x22c55e).setDepth(3)

        // Animated target (for follow shot)
        this.target = this.add.circle(0, 0, 20, 0xfbbf24).setDepth(4)

        // NPC stand-in for DialogCameraCue demo
        this.add.rectangle(200, 0, 40, 80, 0x8b5cf6).setDepth(4)
        this.add.text(200, -60, 'NPC', {
            font: '13px JetBrains Mono, monospace', color: '#a78bfa'
        }).setOrigin(0.5).setDepth(4)

        // Screen-space UI hint
        this.add.text(20, 22, 'Cinema — subsystem landing', {
            font: '15px JetBrains Mono, monospace', color: '#f472b6'
        }).setScrollFactor(0).setDepth(10)

        this.add.text(20, 48, 'CameraDirector · ScreenShake · CameraFlash · Parallax · Letterbox · DialogCue', {
            font: '11px JetBrains Mono, monospace', color: '#475569'
        }).setScrollFactor(0).setDepth(10)

        // ── Cinema features ───────────────────────────────────────────────────
        this.director = this.features.register('camera', CameraDirector)
        this.director.setCamera(this.cameras.main)
        this.features.on(SHOT_DONE, shot => this.panel?.set('shot', `done: ${shot.type}`))

        this.shake = this.features.register('shake', ScreenShake)
        this.shake.setMaxOffset(18).setMaxAngle(0.035)

        this.flash = this.features.register('flash', CameraFlash)

        this.letterbox = this.features.register('letterbox', LetterboxFeature)
        this.letterbox.setBarColor(0x000000).setBarDepth(1050)

        this.cue = this.features.register('cue', DialogCameraCue)
        this.cue.setDimColor(0x000000).setDimAlpha(0.65).setDefaultFade(0.25)

        // ── Panel overlay ─────────────────────────────────────────────────────
        this.panel = this.features.register('panel', CinemaPanel)

        // Animate the follow-shot target in a circle
        this._t = 0
    }

    onUpdate(_time, delta) {
        this._t = (this._t || 0) + delta * 0.001
        if (this.target) {
            this.target.x = Math.cos(this._t) * 180
            this.target.y = Math.sin(this._t) * 120
        }
    }

    handleAction(action) {
        const cam = this.cameras.main
        switch (action) {
            case 'shot-pan':
                this.director.cut({ type: 'pan', x: -500, y: -300, duration: 1.5, ease: EASE_IN_OUT })
                this.panel?.set('shot', 'pan → (-500, -300)')
                break

            case 'shot-zoom':
                this.director.push({ type: 'zoom', zoom: 2.5, duration: 1, ease: EASE_OUT })
                this.panel?.set('shot', 'zoom ×2.5')
                break

            case 'shot-fit':
                this.director.cut({
                    type: 'fit-bounds',
                    x: -600, y: -400, width: 1200, height: 800,
                    duration: 1.5, padding: 60
                })
                this.panel?.set('shot', 'fit-bounds')
                break

            case 'shot-follow':
                this.director.cut({ type: 'follow', target: this.target, lerp: 0.06 })
                this.panel?.set('shot', 'follow target')
                break

            case 'shot-spline':
                this.director.cut({
                    type: 'spline',
                    duration: 5, loop: false,
                    points: [
                        { x: -500, y: -300 }, { x: 500, y: -300 },
                        { x: 500, y:  300 }, { x: -500, y:  300 },
                        { x: 0, y: 0 }
                    ]
                })
                this.panel?.set('shot', 'spline orbit')
                break

            case 'shot-skip':
                this.director.skip()
                break

            case 'shake-impact':
                this.shake.impact(0.8)
                break

            case 'shake-rumble':
                this.shake.rumble(0.5, 1)
                break

            case 'shake-sine':
                this.shake.sine(0.4, 12, 0.8)
                break

            case 'flash-white':
                this.flash.flash(0xffffff, 0.25)
                break

            case 'flash-red':
                this.flash.flash(0xff2244, 0.5, 0.05)
                break

            case 'letterbox-toggle':
                this.letterboxOn = !this.letterboxOn
                this.letterbox.setAspect(this.letterboxOn ? 21 / 9 : cam.width / cam.height)
                this.panel?.set('letterbox', this.letterboxOn ? 'on (21:9)' : 'off')
                break

            case 'cue-open':
                this.cue.focus({ x: 160, y: cam.height / 2 - 80, width: 280, height: 160 }, {
                    vignette: true, fadeSec: 0.3
                })
                break

            case 'cue-close':
                this.cue.clear()
                break
        }
    }
}

export default CinemaLandingDemo
