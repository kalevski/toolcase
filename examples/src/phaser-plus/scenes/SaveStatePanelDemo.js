import {
    Scene,
    SaveService,
    PersistenceFeature,
    LocalStorageBackend,
    Debugger,
    SaveStatePanel,
    SAVE_DONE
} from '@toolcase/phaser-plus'

const NS = 'dbg-save'
const LS_PREFIX = 'phaser-save-panel-demo'

const SCHEMA = {
    version: 2,
    migrations: {
        1: (data) => ({ ...data, playerName: 'Hero' })
    }
}

class SaveStatePanelDemo extends Scene {

    onInit() {
        this.services.bind(SaveService, () => new SaveService({
            backend: new LocalStorageBackend(LS_PREFIX),
            namespace: NS,
            schema: SCHEMA
        }))

        const dbg = this.features.register('debugger', Debugger).setExpanded()
        this.savePanel = dbg.addPanel('save', SaveStatePanel, 'Save State')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.rectangle(0, 0, width, height, 0x0a0e17).setOrigin(0)

        this.score = 0
        this.level = 1

        this.add.text(width / 2, 30, 'SAVE STATE PANEL DEMO', {
            font: 'bold 16px JetBrains Mono, monospace',
            color: '#f8fafc'
        }).setOrigin(0.5, 0)

        this.stateText = this.add.text(width / 2, 90, '', {
            font: '13px JetBrains Mono, monospace',
            color: '#94a3b8',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5, 0)

        this.add.text(width / 2, height - 80, [
            'Left-click: +10 score  |  Right-click: +1 level',
            'Keys 1 / 2 / 3: quick-save to slot-1 / slot-2 / slot-3',
            'Debugger → Save State: type slot ID, then Inspect / Force Load / Delete'
        ].join('\n'), {
            font: '11px JetBrains Mono, monospace',
            color: '#475569',
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5, 0)

        this.persistence = this.features.register('persistence', PersistenceFeature)

        this.savePanel.bind(this.persistence.service)

        this.savePanel.on('load', (_slotId, data) => {
            if (!data) return
            this.score = data.score ?? this.score
            this.level = data.level ?? this.level
            this.refreshText()
        })

        this.features.on(SAVE_DONE, () => this.savePanel.refresh())

        this.input.keyboard.on('keydown-ONE', () => this.quickSave('slot-1'))
        this.input.keyboard.on('keydown-TWO', () => this.quickSave('slot-2'))
        this.input.keyboard.on('keydown-THREE', () => this.quickSave('slot-3'))

        this.input.on('pointerdown', (ptr) => {
            if (ptr.rightButtonDown()) {
                this.level = Math.min(this.level + 1, 99)
            } else {
                this.score += 10
            }
            this.refreshText()
        })

        this.seedSlots()
        this.refreshText()
    }

    async quickSave(slotId) {
        await this.persistence.save(slotId, {
            score: this.score,
            level: this.level,
            location: 'Ember Keep',
            playtime: `${this.level * 3}m`,
            playerName: 'Hero'
        })
    }

    refreshText() {
        this.stateText?.setText([
            `Score : ${this.score}`,
            `Level : ${this.level}`,
            `Loc   : Ember Keep`
        ])
    }

    seedSlots() {
        const lsKey = `${LS_PREFIX}:${NS}:slot-1`
        if (localStorage.getItem(lsKey) !== null) return
        const v1 = JSON.stringify({
            _version: 1,
            _savedAt: Date.now() - 3600000,
            data: { score: 150, level: 3, location: 'Dark Cave', playtime: '15m' }
        })
        localStorage.setItem(lsKey, v1)
    }

}

export default SaveStatePanelDemo
