import {
    Scene,
    HTMLFeature,
    SaveService,
    PersistenceFeature,
    LocalStorageBackend,
    SAVE_DONE,
    LOAD_DONE,
    SAVE_DELETED
} from '@toolcase/phaser-plus'

const SLOT_IDS = ['slot-1', 'slot-2', 'slot-3']
const NS = 'save-demo'
const LS_PREFIX = 'phaser-save-demo'

const SCHEMA = {
    version: 2,
    migrations: {
        1: (data) => ({ ...data, playerName: 'Hero' })
    }
}

function formatAge(ts) {
    const sec = Math.floor((Date.now() - ts) / 1000)
    if (sec < 60) return 'Just now'
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
    return `${Math.floor(sec / 86400)}d ago`
}

class SaveHUD extends HTMLFeature {

    /** @type {import('@toolcase/phaser-plus').PersistenceFeature | null} */ persistence = null
    /** @type {{ score: number, level: number, location: string, playerName: string } | null} */ state = null
    /** @type {string} */ mode = 'load'
    /** @type {string} */ migrationLog = ''

    onCreate() {
        this.node.innerHTML = `
            <div style="
                position:absolute; top:0; right:0; width:340px; height:100%;
                background:rgba(10,14,23,0.92); border-left:1px solid #1e293b;
                display:flex; flex-direction:column; font-family:'JetBrains Mono',monospace; overflow:hidden;
            ">
                <div style="padding:16px; border-bottom:1px solid #1e293b;">
                    <div style="color:#94a3b8; font-size:10px; text-transform:uppercase; letter-spacing:0.1em;">Save Slots</div>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        <button data-mode="load" style="
                            flex:1; padding:6px; background:#1e293b; color:#f8fafc; border:1px solid #334155;
                            font-family:inherit; font-size:11px; cursor:pointer; text-transform:uppercase;
                            letter-spacing:0.05em;
                        ">Load Mode</button>
                        <button data-mode="save" style="
                            flex:1; padding:6px; background:#1e293b; color:#f8fafc; border:1px solid #334155;
                            font-family:inherit; font-size:11px; cursor:pointer; text-transform:uppercase;
                            letter-spacing:0.05em;
                        ">Save Mode</button>
                    </div>
                </div>
                <div style="flex:1; overflow-y:auto; padding:12px;">
                    <tc-save-slot-list id="save-slot-list" mode="load"></tc-save-slot-list>
                </div>
                <div data-migration style="
                    min-height:56px; padding:12px 14px; border-top:1px solid #1e293b;
                    color:#4ade80; font-size:10px; line-height:1.5; display:none;
                "></div>
                <div data-status style="
                    padding:10px 14px; border-top:1px solid #1e293b;
                    color:#64748b; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                ">Ready</div>
            </div>
        `

        this.node.querySelector('[data-mode="load"]').addEventListener('click', () => {
            this.mode = 'load'
            this.getSlotList().mode = 'load'
            this.setStatus('Switched to Load mode')
        })
        this.node.querySelector('[data-mode="save"]').addEventListener('click', () => {
            this.mode = 'save'
            this.getSlotList().mode = 'save'
            this.setStatus('Switched to Save mode')
        })

        const list = this.getSlotList()
        list.onLoad = (id) => this.handleLoad(id)
        list.onSave = (id) => this.handleSave(id)
        list.onDelete = (id) => this.handleDelete(id)
    }

    getSlotList() {
        return this.node.querySelector('#save-slot-list')
    }

    setStatus(msg) {
        const el = this.node.querySelector('[data-status]')
        if (el) el.textContent = msg
    }

    showMigration(msg) {
        const el = this.node.querySelector('[data-migration]')
        if (!el) return
        el.textContent = msg
        el.style.display = msg ? 'block' : 'none'
    }

    async handleLoad(id) {
        if (!this.persistence) return
        const data = await this.persistence.load(id)
        if (data) {
            const entry = (await this.persistence.list()).find(e => e.id === id)
            if (entry && entry.version < SCHEMA.version) {
                this.showMigration(`↑ Migrated v${entry.version}→v${SCHEMA.version}: playerName added`)
            } else {
                this.showMigration('')
            }
        }
    }

    async handleSave(id) {
        if (!this.persistence || !this.state) return
        await this.persistence.save(id, { ...this.state })
        await this.refresh()
        this.setStatus(`Saved to ${id}`)
        this.showMigration('')
    }

    async handleDelete(id) {
        if (!this.persistence) return
        await this.persistence.delete(id)
        await this.refresh()
        this.setStatus(`Deleted ${id}`)
        this.showMigration('')
    }

    async refresh() {
        if (!this.persistence) return
        const entries = await this.persistence.list()
        const slots = await Promise.all(SLOT_IDS.map(async id => {
            const entry = entries.find(e => e.id === id)
            if (!entry) return { id, empty: true }
            const data = await this.persistence.load(id)
            return {
                id,
                name: `Save ${id.slice(-1)}`,
                timestamp: formatAge(entry.savedAt),
                location: data?.location || 'Unknown',
                level: data?.level,
                playtime: data?.playtime || '—'
            }
        }))
        this.getSlotList().slots = slots
    }

}

class SaveServiceDemo extends Scene {

    /** @type {PersistenceFeature | null} */ persistence = null
    /** @type {SaveHUD | null} */ hud = null
    /** @type {number} */ score = 0
    /** @type {number} */ level = 1
    /** @type {Phaser.GameObjects.Text | null} */ stateText = null
    /** @type {Phaser.GameObjects.Text | null} */ helpText = null

    onInit() {
        this.services.bind(SaveService, () => new SaveService({
            backend: new LocalStorageBackend(LS_PREFIX),
            namespace: NS,
            schema: SCHEMA
        }))
    }

    onCreate() {
        const { width, height } = this.game.config
        const cx = (width - 340) / 2

        this.add.rectangle(0, 0, width, height, 0x0a0e17).setOrigin(0)

        this.add.text(cx, 40, 'SAVE SERVICE DEMO', {
            font: 'bold 18px JetBrains Mono, monospace',
            color: '#f8fafc'
        }).setOrigin(0.5, 0)

        this.stateText = this.add.text(cx, 90, '', {
            font: '13px JetBrains Mono, monospace',
            color: '#94a3b8',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5, 0)

        this.helpText = this.add.text(cx, height - 60, [
            'Click canvas to increase score (+10)',
            'Right-click to increase level',
            'Switch mode to Load / Save, then click slot buttons'
        ].join('\n'), {
            font: '11px JetBrains Mono, monospace',
            color: '#475569',
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5, 0)

        this.input.on('pointerdown', (ptr) => {
            if (ptr.rightButtonDown()) {
                this.level = Math.min(this.level + 1, 99)
            } else {
                this.score += 10
            }
            this.refreshStateText()
        })

        this.persistence = this.features.register('persistence', PersistenceFeature)
        this.hud = this.features.register('hud', SaveHUD)
        this.hud.persistence = this.persistence
        this.hud.state = this.getCurrentState()

        this.features.on(LOAD_DONE, (slotId, data) => {
            if (!data) return
            this.score = data.score ?? this.score
            this.level = data.level ?? this.level
            this.refreshStateText()
            this.hud.state = this.getCurrentState()
            this.hud.setStatus(`Loaded ${slotId}`)
        })

        this.features.on(SAVE_DONE, (slotId) => {
            this.hud.refresh()
            this.hud.setStatus(`Saved to ${slotId}`)
        })

        this.features.on(SAVE_DELETED, (slotId) => {
            this.hud.refresh()
            this.hud.setStatus(`Deleted ${slotId}`)
        })

        this.seedV1Demo()
        this.hud.refresh()
        this.refreshStateText()
    }

    getCurrentState() {
        return {
            score: this.score,
            level: this.level,
            location: 'Ember Keep',
            playtime: `${this.level * 3}m`,
            playerName: 'Hero'
        }
    }

    refreshStateText() {
        if (!this.stateText) return
        const state = this.getCurrentState()
        this.hud.state = state
        this.stateText.setText([
            `Score : ${state.score}`,
            `Level : ${state.level}`,
            `Name  : ${state.playerName}`,
            `Loc   : ${state.location}`
        ])
    }

    seedV1Demo() {
        const lsKey = `${LS_PREFIX}:${NS}:slot-3`
        if (localStorage.getItem(lsKey) !== null) return
        const v1Envelope = JSON.stringify({
            _version: 1,
            _savedAt: Date.now() - 3600000,
            data: { score: 850, level: 5, location: 'Dark Cave', playtime: '15m' }
        })
        localStorage.setItem(lsKey, v1Envelope)
    }

}

export default SaveServiceDemo
