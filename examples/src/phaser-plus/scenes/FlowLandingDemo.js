import {
    Scene,
    HTMLFeature,
    StateMachine,
    Flow,
    STATE_TRANSITION
} from '@toolcase/phaser-plus'

/**
 * Flow subsystem landing demo.
 *
 * Presents the full FlowEngine surface in one scene:
 *   Flow.Event    — named one-shot event with 0.5 s delay
 *   Flow.TimeEvent — recurring timer
 *   Flow.Job      — cooperative countdown work
 *   Flow.Timer    — sugar helpers (delay)
 *   Flow.Tween    — property interpolation
 *   Flow.Timeline — sequenced + parallel tweens
 *   StateMachine  — FSM with signal + guard transitions
 *
 * Click the panel buttons on the right to trigger each system.
 */

const PANEL_W = 215

const BTN = `
    display:block; width:100%; padding:7px 12px; margin-bottom:5px; cursor:pointer;
    background:#1e293b; color:#c4b5fd; border:1px solid #334155;
    font-family:'JetBrains Mono',monospace; font-size:11px;
    text-transform:uppercase; letter-spacing:0.05em; text-align:left;
`

const SECT = `
    font-family:'JetBrains Mono',monospace; font-size:9px; color:#475569;
    text-transform:uppercase; letter-spacing:0.1em; margin:12px 0 5px;
`

class FlowPanel extends HTMLFeature {
    /** @type {Map<string, HTMLElement>} */ readouts = new Map()

    onCreate() {
        this.node.innerHTML = `
        <div style="
            position:absolute; top:0; right:0; width:${PANEL_W}px; height:100%;
            background:rgba(10,14,23,0.95); border-left:1px solid #1e293b;
            overflow-y:auto; box-sizing:border-box; padding:12px 14px;
        ">
            <div style="color:#a78bfa; font-size:12px; font-family:'JetBrains Mono',monospace;
                        border-bottom:1px solid #1e293b; padding-bottom:10px; margin-bottom:2px;">
                Flow Engine
            </div>

            <div style="${SECT}">Event</div>
            <button data-a="event" style="${BTN}">Fire damage (0.5 s delay)</button>

            <div style="${SECT}">Time Event (timer)</div>
            <button data-a="timer-start" style="${BTN}">Start interval (1 s)</button>
            <button data-a="timer-stop"  style="${BTN}">Stop interval</button>
            <div data-r="timer" style="font-family:'JetBrains Mono',monospace;
                color:#94a3b8; font-size:11px; margin-bottom:2px;">—</div>

            <div style="${SECT}">Job</div>
            <button data-a="job" style="${BTN}">Run 3 s countdown job</button>
            <div data-r="job" style="font-family:'JetBrains Mono',monospace;
                color:#94a3b8; font-size:11px; margin-bottom:2px;">—</div>

            <div style="${SECT}">Tween</div>
            <button data-a="tween" style="${BTN}">Tween box x (yoyo)</button>

            <div style="${SECT}">Timeline</div>
            <button data-a="timeline" style="${BTN}">Sequence + parallel</button>

            <div style="${SECT}">State Machine</div>
            <div data-r="fsm" style="font-family:'JetBrains Mono',monospace;
                color:#4ade80; font-size:11px; margin-bottom:5px;">idle</div>
            <button data-a="fsm-move" style="${BTN}">Signal: move</button>
            <button data-a="fsm-stop" style="${BTN}">Signal: stop</button>
            <button data-a="fsm-jump" style="${BTN}">Signal: jump</button>
        </div>`

        this.node.querySelectorAll('[data-a]').forEach(btn =>
            btn.addEventListener('click', () => this.scene.handleAction(btn.dataset.a))
        )
        this.node.querySelectorAll('[data-r]').forEach(el =>
            this.readouts.set(el.dataset.r, el)
        )
    }

    set(key, text) {
        const el = this.readouts.get(key)
        if (el) el.textContent = text
    }
}

// ── Flow classes ──────────────────────────────────────────────────────────────

class DamageEvent extends Flow.Event {
    onFire(payload) { this.scene._onDamage(payload.amount) }
}

class SpawnTick extends Flow.TimeEvent {
    onFire(n) { this.scene._onTick(n) }
}

class CountdownJob extends Flow.Job {
    onCreate() { this.remaining = 3 }
    onUpdate(_time, delta) {
        this.remaining -= delta / 1000
        this.scene._onJobProgress(Math.max(0, this.remaining))
        return this.remaining <= 0
    }
    onComplete() { this.scene._onJobDone() }
}

// ── Scene ─────────────────────────────────────────────────────────────────────

class FlowLandingDemo extends Scene {
    /** @type {FlowPanel|null} */    panel    = null
    /** @type {StateMachine|null} */ fsm      = null
    /** @type {Phaser.GameObjects.Rectangle|null} */ box = null
    /** @type {Phaser.GameObjects.Text|null} */      log = null
    /** @type {string[]} */          lines    = []
    /** @type {boolean} */           timerOn  = false

    onInit() {
        this.flow.events.add('damage', DamageEvent)
    }

    onCreate() {
        const { width, height } = this.game.config
        const cx = (width - PANEL_W) / 2

        this.add.rectangle(0, 0, width, height, 0x0a0e17).setOrigin(0)

        this.add.text(cx, 22, 'Flow Engine — subsystem landing', {
            font: '15px JetBrains Mono, monospace', color: '#a78bfa'
        }).setOrigin(0.5)

        this.add.text(cx, 46, 'Event · TimeEvent · Job · Tween · Timeline · StateMachine', {
            font: '11px JetBrains Mono, monospace', color: '#475569'
        }).setOrigin(0.5)

        // Animated box — target for tween / timeline demos
        this.box = this.add.rectangle(cx, height / 2, 60, 60, 0x6366f1)
        this.add.text(cx, height / 2 + 46, 'tween / timeline target', {
            font: '11px JetBrains Mono, monospace', color: '#334155'
        }).setOrigin(0.5)

        // Event log
        this.log = this.add.text(14, 66, '', {
            font: '12px JetBrains Mono, monospace', color: '#475569', lineSpacing: 5
        })

        // State machine: idle ↔ run ↔ jump
        this.fsm = this.features.register('demo-fsm', StateMachine)
        this.fsm
            .setContext({ box: this.box })
            .addState('idle', { onEnter: c => { c.box.fillColor = 0x6366f1 } })
            .addState('run',  { onEnter: c => { c.box.fillColor = 0x22c55e } })
            .addState('jump', { onEnter: c => { c.box.fillColor = 0xf59e0b } })
            .addTransition('idle', 'run',  'move')
            .addTransition('run',  'idle', 'stop')
            .addTransition(null,   'jump', 'jump')
            .addTransition('jump', 'idle', 'stop')

        this.features.on(STATE_TRANSITION, (from, to) => {
            this.panel?.set('fsm', to)
            this._log(`FSM  ${from ?? '∅'} → ${to}`)
        })

        // HTML panel (must be registered last so HTMLFeature overlay sits on top)
        this.panel = this.features.register('panel', FlowPanel)
    }

    handleAction(action) {
        switch (action) {
            case 'event':
                this.flow.events.trigger('damage', { amount: 42 }, 0.5)
                this._log('Event queued: damage arrives in 0.5 s')
                break

            case 'timer-start':
                if (!this.timerOn) {
                    this.timerOn = true
                    this.flow.timer.add('tick', SpawnTick, 1, 0)
                    this._log('TimeEvent: started (every 1 s)')
                }
                break

            case 'timer-stop':
                if (this.timerOn) {
                    this.timerOn = false
                    this.flow.timer.remove('tick')
                    this.panel?.set('timer', '—')
                    this._log('TimeEvent: stopped')
                }
                break

            case 'job':
                this.flow.jobs.run(CountdownJob, {})
                this._log('Job: 3 s countdown started')
                break

            case 'tween': {
                const cx = (this.game.config.width - PANEL_W) / 2
                const toX = Math.abs(this.box.x - cx) < 10 ? cx + 110 : cx
                Flow.Tween.to(this, this.box, { x: toX }, {
                    ms: 700, ease: 'easeOutCubic', yoyo: true
                })
                this._log(`Tween: x → ${toX}`)
                break
            }

            case 'timeline':
                new Flow.Timeline(this)
                    .to(this.box, { scaleX: 1.7 }, { ms: 200, ease: 'easeOutBack' })
                    .wait(80)
                    .parallel(sub => {
                        sub.to(this.box, { scaleX: 1 }, { ms: 300, ease: 'easeInCubic' })
                        sub.to(this.box, { angle: 360 }, { ms: 450, ease: 'linear' })
                    })
                    .call(() => { this.box.angle = 0; this._log('Timeline: complete') })
                    .play()
                this._log('Timeline: scale ‖ rotate')
                break

            case 'fsm-move': this.fsm?.fire('move'); break
            case 'fsm-stop': this.fsm?.fire('stop'); break
            case 'fsm-jump': this.fsm?.fire('jump'); break
        }
    }

    _onDamage(amount) {
        this._log(`Event fired: damage = ${amount}`)
        if (this.box) {
            const orig = this.box.fillColor
            this.box.fillColor = 0xef4444
            Flow.Timer.delay(this, 0.1, () => { this.box.fillColor = orig })
        }
    }

    _onTick(n) {
        this.panel?.set('timer', `tick #${n}`)
        this._log(`TimeEvent tick #${n}`)
    }

    _onJobProgress(remaining) {
        this.panel?.set('job', `${remaining.toFixed(1)} s remaining`)
    }

    _onJobDone() {
        this.panel?.set('job', 'complete!')
        this._log('Job: countdown complete')
    }

    _log(msg) {
        this.lines.unshift(msg)
        if (this.lines.length > 9) this.lines.length = 9
        this.log?.setText(this.lines.join('\n'))
    }
}

export default FlowLandingDemo
