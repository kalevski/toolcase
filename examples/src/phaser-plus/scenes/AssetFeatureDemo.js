import {
    Scene,
    HTMLFeature,
    AssetFeature,
    ASSET_PROGRESS,
    ASSET_LOAD_COMPLETE,
    ASSET_LOAD_ERROR
} from '@toolcase/phaser-plus'

const MANIFEST = {
    bundles: {
        sprites: {
            atlases: [
                { key: 'objects', textureUrl: '/assets/objects.png', atlasUrl: '/assets/objects.json' }
            ]
        },
        extras: {
            images: [
                { key: 'objects-copy', url: '/assets/objects.png' }
            ]
        },
        broken: {
            images: [
                { key: 'nonexistent', url: '/assets/nonexistent-404.png' }
            ]
        }
    }
}

const BTN = `
    padding:8px 14px; background:#1e293b; color:#f8fafc; border:1px solid #334155;
    font-family:'JetBrains Mono',monospace; font-size:11px; cursor:pointer;
    text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;
    display:block; width:100%; text-align:left;
`

class LoadingHUD extends HTMLFeature {

    /** @type {AssetFeature|null} */ assets = null

    /** @type {Phaser.GameObjects.Image|null} */ spriteRef = null

    /** @type {boolean} */ busy = false

    onCreate() {
        this.node.innerHTML = `
            <div style="
                position:absolute; top:0; right:0; width:256px; height:100%;
                background:rgba(10,14,23,0.95); border-left:1px solid #1e293b;
                display:flex; flex-direction:column; font-family:'JetBrains Mono',monospace;
            ">
                <div style="padding:14px 16px; border-bottom:1px solid #1e293b;">
                    <div style="color:#94a3b8; font-size:10px; text-transform:uppercase;
                                letter-spacing:0.1em; margin-bottom:12px;">
                        Asset Feature
                    </div>
                    <button data-action="sprites" style="${BTN}">Load bundle: sprites</button>
                    <button data-action="extras" style="${BTN}">Load bundle: extras</button>
                    <button data-action="broken" style="${BTN}">Load broken (retry demo)</button>
                    <button data-action="reload" style="${BTN} margin-top:4px; border-color:#334155; color:#475569;" disabled>
                        Hot-reload: objects
                    </button>
                </div>
                <div style="flex:1; padding:14px 16px; overflow-y:auto;">
                    <div style="color:#64748b; font-size:10px; text-transform:uppercase;
                                letter-spacing:0.08em; margin-bottom:8px;">Status</div>
                    <div data-status style="color:#94a3b8; font-size:11px; line-height:1.7;
                                            white-space:pre-wrap;"></div>
                </div>
                <div data-progress-row style="padding:10px 16px; border-top:1px solid #1e293b; display:none;">
                    <div style="color:#64748b; font-size:10px; text-transform:uppercase;
                                letter-spacing:0.05em; margin-bottom:6px;">Progress</div>
                    <div style="height:3px; background:#1e293b; position:relative;">
                        <div data-bar style="height:3px; background:#6366f1; width:0%;
                                             transition:width 0.1s;"></div>
                    </div>
                    <div data-pct style="color:#6366f1; font-size:10px; margin-top:4px;
                                         text-align:right;">0%</div>
                </div>
            </div>
            <tc-loading-screen
                id="asset-screen"
                eyebrow="Loading"
                title-text=""
                label=""
                hidden>
            </tc-loading-screen>
        `

        this.node.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => this.handleAction(btn.dataset.action))
        })

        this.setStatus('Ready.\n\nClick a button to load\na bundle.')
    }

    handleAction(action) {
        if (!this.assets || this.busy) return

        if (action === 'reload') {
            if (!this.assets.has('objects')) return
            this.busy = true
            this.setStatus('Hot-reloading "objects" atlas...')
            this.assets.reload('objects')
                .then(() => {
                    this.busy = false
                    this.setStatus(
                        'Hot-reload complete.\n\n' +
                        'has("objects") = ' + this.assets.has('objects')
                    )
                    if (this.spriteRef) {
                        this.spriteRef.setTexture('objects', 'circle_green')
                    }
                })
                .catch(err => {
                    this.busy = false
                    this.setStatus('Reload error:\n' + err.message)
                })
            return
        }

        this.busy = true
        this.showProgress(true)
        this.setProgress(0)
        this.showLoadingScreen(action)
        this.setStatus(`Loading "${action}"...`)

        this.assets.load(action).catch(() => {})
    }

    showLoadingScreen(bundleName) {
        const screen = this.node.querySelector('#asset-screen')
        if (!screen) return
        screen.setAttribute('title-text', `Loading "${bundleName}"`)
        screen.setAttribute('label', bundleName)
        screen.removeAttribute('hidden')
        screen.progress = 0
    }

    hideLoadingScreen() {
        const screen = this.node.querySelector('#asset-screen')
        if (screen) screen.setAttribute('hidden', '')
    }

    setProgress(value) {
        const bar = this.node.querySelector('[data-bar]')
        const pct = this.node.querySelector('[data-pct]')
        const screen = this.node.querySelector('#asset-screen')
        if (bar) bar.style.width = `${Math.round(value * 100)}%`
        if (pct) pct.textContent = `${Math.round(value * 100)}%`
        if (screen && !screen.hasAttribute('hidden')) screen.progress = value
    }

    showProgress(show) {
        const row = this.node.querySelector('[data-progress-row]')
        if (row) row.style.display = show ? 'block' : 'none'
    }

    setStatus(text) {
        const el = this.node.querySelector('[data-status]')
        if (el) el.textContent = text
    }

    enableReload() {
        const btn = this.node.querySelector('[data-action="reload"]')
        if (!btn) return
        btn.disabled = false
        btn.style.color = '#94a3b8'
    }

}

class AssetFeatureDemo extends Scene {

    /** @type {AssetFeature|null} */ assets = null

    /** @type {LoadingHUD|null} */ hud = null

    /** @type {Phaser.GameObjects.Image|null} */ sprite = null

    /** @type {Phaser.GameObjects.Text|null} */ hint = null

    onCreate() {
        const { width, height } = this.game.config
        const cx = (width - 256) / 2

        this.add.rectangle(0, 0, width, height, 0x0a0e17).setOrigin(0)

        this.hint = this.add.text(cx, height / 2, 'Load the "sprites" bundle\nto see a sprite here.', {
            font: '14px JetBrains Mono, monospace',
            color: '#475569',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5)

        this.assets = this.features.register('assets', AssetFeature)
        this.assets.retries = 2
        this.assets.define(MANIFEST)

        this.hud = this.features.register('hud', LoadingHUD)
        this.hud.assets = this.assets

        this.features.on(ASSET_PROGRESS, (progress) => {
            this.hud?.setProgress(progress)
        })

        this.features.on(ASSET_LOAD_COMPLETE, (bundles) => {
            if (!this.hud) return
            this.hud.busy = false
            this.hud.hideLoadingScreen()
            this.hud.showProgress(false)

            const lines = []
            if (this.assets?.has('objects'))      lines.push('· objects (atlas)')
            if (this.assets?.has('objects-copy')) lines.push('· objects-copy (image)')

            this.hud.setStatus(
                `"${bundles[0]}" loaded.\n\nLoaded:\n` + (lines.join('\n') || '(none yet)')
            )

            if (this.assets?.has('objects') && !this.sprite) {
                this.hint?.setVisible(false)
                this.sprite = this.add.image(cx, height / 2, 'objects', 'circle_green')
                this.hud.spriteRef = this.sprite
                this.hud.enableReload()
            }
        })

        this.features.on(ASSET_LOAD_ERROR, (error) => {
            if (!this.hud) return
            this.hud.busy = false
            this.hud.hideLoadingScreen()
            this.hud.showProgress(false)
            this.hud.setStatus(
                `Failed after ${this.assets?.retries ?? 0} retries.\n\nError:\n${error.message}`
            )
        })
    }

}

export default AssetFeatureDemo
