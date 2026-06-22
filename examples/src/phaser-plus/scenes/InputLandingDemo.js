import {
    Scene,
    HTMLFeature,
    InputFeature,
    InputBuffer,
    GestureRecognizer,
    GamepadFeature,
    Flow,
    ACTION_PRESS,
    ACTION_RELEASE,
    GESTURE_TAP,
    GESTURE_DOUBLE_TAP,
    GESTURE_LONG_PRESS,
    GESTURE_SWIPE,
    GESTURE_PINCH,
    GAMEPAD_CONNECTED,
    GAMEPAD_DISCONNECTED,
    GAMEPAD_BUTTON_DOWN
} from '@toolcase/phaser-plus'

/**
 * Input subsystem landing demo.
 *
 * Presents the full Input surface in one scene:
 *   InputFeature      — action map (WASD + Space), isPressed query, hold timer
 *   InputBuffer       — sliding-window combo: triple Space in ≤ 600 ms
 *   GestureRecognizer — tap, double-tap, long-press, swipe, pinch
 *   GamepadFeature    — connect/disconnect events + per-button readout
 *
 * Move the square with WASD or arrow keys. Press Space three times quickly
 * to trigger the triple-jump combo. Touch / trackpad gestures appear in
 * the right-hand panel.
 */

const PANEL_W = 200

const LABEL_STYLE = `
    font-family:'JetBrains Mono',monospace; font-size:9px; color:#475569;
    text-transform:uppercase; letter-spacing:0.1em; margin:12px 0 5px;
`

const READ_STYLE = `
    font-family:'JetBrains Mono',monospace; font-size:11px;
    color:#94a3b8; line-height:1.7; white-space:pre; margin-bottom:4px;
`

class InputHUD extends HTMLFeature {
    /** @type {Map<string, HTMLElement>} */ readouts = new Map()

    onCreate() {
        this.node.innerHTML = `
        <div style="
            position:absolute; top:0; right:0; width:${PANEL_W}px; height:100%;
            background:rgba(10,14,23,0.95); border-left:1px solid #1e293b;
            box-sizing:border-box; padding:12px 14px; overflow-y:auto;
        ">
            <div style="color:#34d399; font-size:12px; font-family:'JetBrains Mono',monospace;
                        border-bottom:1px solid #1e293b; padding-bottom:10px; margin-bottom:4px;">
                Input Systems
            </div>

            <div style="${LABEL_STYLE}">Action Map</div>
            <div style="font-family:'JetBrains Mono',monospace; font-size:10px;
                        color:#64748b; margin-bottom:4px;">WASD / arrows / Space</div>
            <div data-r="action" style="${READ_STYLE}">—</div>

            <div style="${LABEL_STYLE}">Buffer / Combos</div>
            <div style="font-family:'JetBrains Mono',monospace; font-size:10px;
                        color:#64748b; margin-bottom:4px;">Space ×3 within 600 ms</div>
            <div data-r="combo" style="${READ_STYLE}">waiting…</div>

            <div style="${LABEL_STYLE}">Gestures</div>
            <div style="font-family:'JetBrains Mono',monospace; font-size:10px;
                        color:#64748b; margin-bottom:4px;">tap · double-tap · swipe · pinch</div>
            <div data-r="gesture" style="${READ_STYLE}">—</div>

            <div style="${LABEL_STYLE}">Gamepad</div>
            <div data-r="gamepad" style="${READ_STYLE}">not connected</div>
        </div>`

        this.node.querySelectorAll('[data-r]').forEach(el =>
            this.readouts.set(el.dataset.r, el)
        )
    }

    set(key, text) {
        const el = this.readouts.get(key)
        if (el) el.textContent = text
    }
}

class InputLandingDemo extends Scene {
    /** @type {InputHUD|null} */     hud    = null
    /** @type {InputFeature|null} */ input  = null
    /** @type {InputBuffer|null} */  buffer = null
    /** @type {Phaser.GameObjects.Rectangle|null} */ player = null

    // Combo tracking (plain counter, no internal buffer access needed)
    /** @type {number} */ _jumpCount  = 0
    /** @type {number} */ _lastJumpMs = 0

    onCreate() {
        const { width, height } = this.game.config
        const cx = (width - PANEL_W) / 2

        this.add.rectangle(0, 0, width, height, 0x0a0e17).setOrigin(0)

        this.add.text(cx, 22, 'Input — subsystem landing', {
            font: '15px JetBrains Mono, monospace', color: '#34d399'
        }).setOrigin(0.5)

        this.add.text(cx, 46, 'InputFeature · InputBuffer · GestureRecognizer · GamepadFeature', {
            font: '11px JetBrains Mono, monospace', color: '#475569'
        }).setOrigin(0.5)

        // Player square — moved by InputFeature actions
        this.player = this.add.rectangle(cx, height / 2, 56, 56, 0x34d399)
        this.add.text(cx, height / 2 + 44, 'WASD / arrows to move  ·  Space ×3 = combo', {
            font: '12px JetBrains Mono, monospace', color: '#334155'
        }).setOrigin(0.5)

        // ── InputFeature ──────────────────────────────────────────────────────
        this.input = this.features.register('input', InputFeature)
        this.input.bind('left',  [{ type: 'key', code: 'A' }, { type: 'key', code: 'LEFT' }])
        this.input.bind('right', [{ type: 'key', code: 'D' }, { type: 'key', code: 'RIGHT' }])
        this.input.bind('up',    [{ type: 'key', code: 'W' }, { type: 'key', code: 'UP' }])
        this.input.bind('down',  [{ type: 'key', code: 'S' }, { type: 'key', code: 'DOWN' }])
        this.input.bind('jump',  [{ type: 'key', code: 'SPACE' }])

        this.features.on(ACTION_PRESS, action => {
            this.hud?.set('action', `PRESS  ${action}`)
            this._onPress(action)
        })
        this.features.on(ACTION_RELEASE, (action, holdMs) => {
            this.hud?.set('action', `release ${action}\nheld: ${holdMs.toFixed(0)} ms`)
        })

        // ── InputBuffer ───────────────────────────────────────────────────────
        // Ring buffer of recent inputs; consume/peek detect within a leniency window
        this.buffer = this.features.register('input-buffer', InputBuffer)
        this.buffer.setCapacity(16).setWindow(600)

        // ── GestureRecognizer ─────────────────────────────────────────────────
        const gestures = this.features.register('gestures', GestureRecognizer)
        gestures.on(GESTURE_TAP,        ({ x, y }) =>
            this.hud?.set('gesture', `tap (${x | 0}, ${y | 0})`)
        )
        gestures.on(GESTURE_DOUBLE_TAP, ({ x, y }) =>
            this.hud?.set('gesture', `double-tap (${x | 0}, ${y | 0})`)
        )
        gestures.on(GESTURE_LONG_PRESS, ({ x, y }) =>
            this.hud?.set('gesture', `long-press (${x | 0}, ${y | 0})`)
        )
        gestures.on(GESTURE_SWIPE, ({ direction, length }) =>
            this.hud?.set('gesture', `swipe ${direction}\nlength: ${length | 0} px`)
        )
        gestures.on(GESTURE_PINCH, ({ scale }) =>
            this.hud?.set('gesture', `pinch ×${scale.toFixed(2)}`)
        )

        // ── GamepadFeature ────────────────────────────────────────────────────
        const gamepad = this.features.register('gamepad', GamepadFeature)
        gamepad.setDefaultDeadZone(0.15)

        this.features.on(GAMEPAD_CONNECTED,    idx =>
            this.hud?.set('gamepad', `pad ${idx} connected`)
        )
        this.features.on(GAMEPAD_DISCONNECTED, idx =>
            this.hud?.set('gamepad', `pad ${idx} disconnected`)
        )
        this.features.on(GAMEPAD_BUTTON_DOWN, (idx, btn) =>
            this.hud?.set('gamepad', `pad ${idx}  btn ${btn}`)
        )

        // ── HUD overlay ───────────────────────────────────────────────────────
        this.hud = this.features.register('hud', InputHUD)
        this.hud.set('action', 'waiting…')
    }

    onUpdate(_time, delta) {
        if (!this.input || !this.player) return
        const speed = 0.35 * delta
        if (this.input.isPressed('left'))  this.player.x -= speed
        if (this.input.isPressed('right')) this.player.x += speed
        if (this.input.isPressed('up'))    this.player.y -= speed
        if (this.input.isPressed('down'))  this.player.y += speed
    }

    _onPress(action) {
        // Push into InputBuffer for leniency-window checks
        this.buffer.push(action)

        if (action !== 'jump') return

        // Manual combo counter: triple Space within 600 ms
        const now = Date.now()
        if (now - this._lastJumpMs > 600) this._jumpCount = 0
        this._jumpCount++
        this._lastJumpMs = now

        if (this._jumpCount >= 3) {
            this._jumpCount = 0
            this.hud?.set('combo', '✦ TRIPLE JUMP! ✦')
            if (this.player) {
                this.player.fillColor = 0xf59e0b
                // restore colour after 0.4 s using Flow.Timer sugar
                Flow.Timer.delay(this, 0.4, () => {
                    if (this.player) this.player.fillColor = 0x34d399
                })
            }
        } else {
            this.hud?.set('combo', `jump ×${this._jumpCount}`)
        }
    }
}

export default InputLandingDemo
