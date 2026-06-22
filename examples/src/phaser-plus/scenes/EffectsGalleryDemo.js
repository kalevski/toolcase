import { Scene, EFFECT_REGISTRY, EffectManager, HTMLFeature } from '@toolcase/phaser-plus'

// ── Family metadata (mirrors registry.ts import order) ────────────
const FAMILY_DEFS = [
    { name: 'Color',      start: 0,  count: 16, color: 0x3b82f6 },
    { name: 'Procedural', start: 16, count: 13, color: 0xf59e0b },
    { name: 'Distortion', start: 29, count: 13, color: 0x10b981 },
    { name: 'Dissolve',   start: 42, count: 7,  color: 0xef4444 },
    { name: 'Mask',       start: 49, count: 8,  color: 0x8b5cf6 },
    { name: 'Lighting',   start: 57, count: 16, color: 0xf472b6 },
]

/** @type {Map<any, {name: string, start: number, count: number, color: number}>} */
const FAMILY_MAP = new Map()
for (const fam of FAMILY_DEFS) {
    for (let i = fam.start; i < fam.start + fam.count; i++) {
        FAMILY_MAP.set(EFFECT_REGISTRY[i], fam)
    }
}

function effectLabel(E) {
    return E.KEY.replace(/^reef\./, '').replace(/(?:FX|Effect)$/, '')
}

// ── DOM search input via HTMLFeature ──────────────────────────────
class SearchFeature extends HTMLFeature {
    /** @type {((q: string) => void)|null} */
    onInput = null

    onCreate() {
        this.node.innerHTML = `<input type="text" placeholder="search effects…" data-q style="
            position:absolute; top:9px; left:480px;
            background:#1e293b; border:1px solid #475569; color:#f8fafc;
            font-family:'JetBrains Mono',monospace; font-size:12px;
            padding:5px 10px; outline:none; width:210px;
        ">`
        this.node.querySelector('[data-q]').addEventListener('input', e => {
            this.onInput?.(/** @type {HTMLInputElement} */(e.target).value)
        })
    }
}

// ── Layout constants ──────────────────────────────────────────────
const COLS      = 4
const CARD_W    = 180
const CARD_H    = 100
const GAP       = 8
const GRID_X    = 14
const GRID_Y    = 88
const ROWS      = 5
const PAGE_SIZE = COLS * ROWS   // 20 cards per page
const SPLIT     = 786           // x-divider between grid and preview

// ── Scene ─────────────────────────────────────────────────────────
class EffectsGalleryDemo extends Scene {

    searchQuery = ''
    selectedFamily = 'All'
    page = 0

    /** @type {any} */          activeEffectClass = null
    /** @type {import('@toolcase/phaser-plus').Effect|null} */ activeEffect = null

    /** @type {Array<{bg: Phaser.GameObjects.Graphics, sprite: Phaser.GameObjects.Sprite, mgr: EffectManager, lbl: Phaser.GameObjects.Text, zone: Phaser.GameObjects.Zone, x: number, y: number, effectClass: any}>} */
    slots = []

    familyChips = {}

    /** @type {Phaser.GameObjects.Text|null} */ prevBtn = null
    /** @type {Phaser.GameObjects.Text|null} */ nextBtn = null
    /** @type {Phaser.GameObjects.Text|null} */ pageLabel = null

    /** @type {Phaser.GameObjects.Sprite|null} */   previewSprite = null
    /** @type {EffectManager|null} */               previewMgr = null
    /** @type {Phaser.GameObjects.Text|null} */     previewNameTxt = null
    /** @type {Phaser.GameObjects.Text|null} */     previewFamTxt = null
    /** @type {Phaser.GameObjects.Text|null} */     hintTxt = null

    tweakRows = []
    tweakBaseY = 0

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onCreate() {
        const { width, height } = this.game.config
        this.cameras.main.setBackgroundColor('#0f172a')

        const sf = this.features.register('search', SearchFeature)
        sf.onInput = q => { this.searchQuery = q; this.page = 0; this.refresh() }

        this._buildTopBar()
        this._buildFamilyChips()
        this._buildDivider(height)
        this._buildCardSlots()
        this._buildNav()
        this._buildPreview(width)

        this.refresh()
    }

    // ── Top bar ───────────────────────────────────────────────────
    _buildTopBar() {
        this.add.text(GRID_X, 10, 'Effects Gallery', {
            font: 'bold 16px JetBrains Mono, monospace',
            color: '#f8fafc'
        })
        this.add.text(GRID_X, 30, `${EFFECT_REGISTRY.length} effects · 6 families · WebGL`, {
            font: '10px JetBrains Mono, monospace',
            color: '#475569'
        })
    }

    // ── Family filter chips ───────────────────────────────────────
    _buildFamilyChips() {
        let x = GRID_X
        const y = 54

        for (const name of ['All', ...FAMILY_DEFS.map(f => f.name)]) {
            const chip = this.add.text(x, y, name, {
                font: '10px JetBrains Mono, monospace',
                color: name === 'All' ? '#0f172a' : '#94a3b8',
                backgroundColor: name === 'All' ? '#38bdf8' : '#1e293b',
                padding: { x: 7, y: 4 }
            }).setInteractive({ useHandCursor: true })

            chip.on('pointerover', () => {
                if (this.selectedFamily !== name) chip.setColor('#f8fafc')
            })
            chip.on('pointerout', () => {
                if (this.selectedFamily !== name) {
                    chip.setColor('#94a3b8')
                    chip.setBackgroundColor('#1e293b')
                }
            })
            chip.on('pointerdown', () => this._setFamily(name))

            this.familyChips[name] = chip
            x += chip.width + 5
        }
    }

    // ── Vertical divider ──────────────────────────────────────────
    _buildDivider(height) {
        const g = this.add.graphics()
        g.fillStyle(0x1e293b, 1)
        g.fillRect(SPLIT, 0, 1, height)
    }

    // ── Grid of card slots (virtualised) ─────────────────────────
    _buildCardSlots() {
        for (let i = 0; i < PAGE_SIZE; i++) {
            const col = i % COLS
            const row = Math.floor(i / COLS)
            const x = GRID_X + col * (CARD_W + GAP)
            const y = GRID_Y + row * (CARD_H + GAP)

            const bg     = this.add.graphics()
            const sprite = this.add.sprite(x + CARD_W / 2, y + CARD_H / 2 - 6, 'objects', 'turtle_left')
            sprite.setScale(0.32).setVisible(false)
            const mgr = new EffectManager(sprite)
            const lbl = this.add.text(x + CARD_W / 2, y + CARD_H - 10, '', {
                font: '9px JetBrains Mono, monospace',
                color: '#94a3b8'
            }).setOrigin(0.5, 1).setVisible(false)
            const zone = this.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H)
                .setInteractive({ useHandCursor: true })

            const slot = { bg, sprite, mgr, lbl, zone, x, y, effectClass: null }

            zone.on('pointerover', () => {
                if (slot.effectClass) this._tintCard(slot, 0x1e3a5f, true)
            })
            zone.on('pointerout', () => {
                if (slot.effectClass) {
                    const sel = slot.effectClass === this.activeEffectClass
                    this._tintCard(slot, sel ? 0x1e3a5f : 0x1e293b, sel)
                }
            })
            zone.on('pointerdown', () => {
                if (slot.effectClass) this._selectEffect(slot.effectClass)
            })

            this.slots.push(slot)
        }

        this.input.on('wheel', (_ptr, _objs, _dx, deltaY) => {
            if (deltaY > 0) this._goPage(+1)
            else this._goPage(-1)
        })
    }

    // ── Pagination buttons ────────────────────────────────────────
    _buildNav() {
        const navY = GRID_Y + ROWS * (CARD_H + GAP) - GAP + 10

        this.prevBtn = this.add.text(GRID_X, navY, '◀ prev', {
            font: '10px JetBrains Mono, monospace',
            color: '#94a3b8',
            backgroundColor: '#1e293b',
            padding: { x: 8, y: 4 }
        }).setInteractive({ useHandCursor: true })
        this.prevBtn.on('pointerdown', () => this._goPage(-1))

        this.pageLabel = this.add.text(SPLIT / 2, navY + 4, '', {
            font: '10px JetBrains Mono, monospace',
            color: '#475569'
        }).setOrigin(0.5, 0)

        this.nextBtn = this.add.text(SPLIT - 70, navY, 'next ▶', {
            font: '10px JetBrains Mono, monospace',
            color: '#94a3b8',
            backgroundColor: '#1e293b',
            padding: { x: 8, y: 4 }
        }).setInteractive({ useHandCursor: true })
        this.nextBtn.on('pointerdown', () => this._goPage(+1))
    }

    // ── Right-side preview panel ──────────────────────────────────
    _buildPreview(width) {
        const cx = Math.round((SPLIT + width) / 2)

        this.add.text(SPLIT + 14, GRID_Y, 'PREVIEW', {
            font: '9px JetBrains Mono, monospace',
            color: '#475569'
        })

        const sprY = GRID_Y + 200
        this.previewSprite = this.add.sprite(cx, sprY, 'objects', 'turtle_left')
        this.previewSprite.setScale(1.5).setVisible(false)
        this.previewMgr = new EffectManager(this.previewSprite)

        this.hintTxt = this.add.text(cx, sprY, '← click a card\n   to preview', {
            font: '14px JetBrains Mono, monospace',
            color: '#334155',
            align: 'center'
        }).setOrigin(0.5)

        const txY = sprY + 186
        this.previewNameTxt = this.add.text(cx, txY, '', {
            font: 'bold 15px JetBrains Mono, monospace',
            color: '#f8fafc'
        }).setOrigin(0.5, 0)
        this.previewFamTxt = this.add.text(cx, txY + 24, '', {
            font: '11px JetBrains Mono, monospace',
            color: '#94a3b8'
        }).setOrigin(0.5, 0)

        this.add.text(SPLIT + 14, txY + 54, 'TWEAKS', {
            font: '9px JetBrains Mono, monospace',
            color: '#475569'
        })
        this.tweakBaseY = txY + 72
    }

    // ── Filtered effect list ──────────────────────────────────────
    _getFiltered() {
        const q = this.searchQuery.toLowerCase()
        return EFFECT_REGISTRY.filter(E => {
            const n = effectLabel(E).toLowerCase()
            return (this.selectedFamily === 'All' || FAMILY_MAP.get(E)?.name === this.selectedFamily) &&
                   (!q || n.includes(q))
        })
    }

    // ── Refresh grid ──────────────────────────────────────────────
    refresh() {
        const all    = this._getFiltered()
        const pages  = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
        this.page    = Math.min(this.page, pages - 1)
        const start  = this.page * PAGE_SIZE

        for (let i = 0; i < PAGE_SIZE; i++) {
            const slot = this.slots[i]
            const EC   = all[start + i] ?? null

            if (!EC) {
                slot.bg.clear()
                slot.sprite.setVisible(false)
                slot.lbl.setVisible(false)
                slot.effectClass = null
                continue
            }

            if (slot.effectClass !== EC) {
                slot.mgr.clear()
                slot.mgr.add(EC)
                slot.effectClass = EC
                slot.lbl.setText(effectLabel(EC))
            }

            const sel = EC === this.activeEffectClass
            this._tintCard(slot, sel ? 0x1e3a5f : 0x1e293b, sel)
            slot.sprite.setVisible(true)
            slot.lbl.setVisible(true)
        }

        this.pageLabel?.setText(`page ${this.page + 1} / ${pages}  (${all.length})`)
        this.prevBtn?.setAlpha(this.page > 0 ? 1 : 0.3)
        this.nextBtn?.setAlpha(this.page < pages - 1 ? 1 : 0.3)
    }

    // ── Redraw a single card background ──────────────────────────
    _tintCard(slot, bgColor, selected) {
        const fam = FAMILY_MAP.get(slot.effectClass)
        slot.bg.clear()
        slot.bg.fillStyle(bgColor, 1)
        slot.bg.fillRect(slot.x, slot.y, CARD_W, CARD_H)
        if (selected) {
            slot.bg.lineStyle(2, 0x38bdf8, 1)
            slot.bg.strokeRect(slot.x, slot.y, CARD_W, CARD_H)
        }
        if (fam) {
            slot.bg.fillStyle(fam.color, 1)
            slot.bg.fillRect(slot.x, slot.y, CARD_W, 3)
        }
    }

    // ── Switch active family filter ───────────────────────────────
    _setFamily(name) {
        this.selectedFamily = name
        this.page = 0
        for (const [n, chip] of Object.entries(this.familyChips)) {
            const active = n === name
            chip.setColor(active ? '#0f172a' : '#94a3b8')
            chip.setBackgroundColor(active ? '#38bdf8' : '#1e293b')
        }
        this.refresh()
    }

    // ── Advance page ──────────────────────────────────────────────
    _goPage(dir) {
        const pages = Math.max(1, Math.ceil(this._getFiltered().length / PAGE_SIZE))
        this.page = Math.max(0, Math.min(this.page + dir, pages - 1))
        this.refresh()
    }

    // ── Apply the clicked effect to the preview sprite ───────────
    _selectEffect(EC) {
        this.activeEffectClass = EC
        this.previewMgr.clear()
        this.activeEffect = this.previewMgr.add(EC)

        const fam = FAMILY_MAP.get(EC)
        this.hintTxt.setVisible(false)
        this.previewSprite.setVisible(true)
        this.previewNameTxt.setText(effectLabel(EC))
        this.previewFamTxt
            .setText(fam?.name ?? '')
            .setColor(fam ? '#' + fam.color.toString(16).padStart(6, '0') : '#94a3b8')

        this._buildTweakRows()
        this.refresh()
    }

    // ── Build uniform tweak rows for the active effect ────────────
    _buildTweakRows() {
        this._clearTweakRows()
        if (!this.activeEffect) return

        const PROPS = ['alpha', 'speed', 'intensity', 'amount', 'noise', 'freq', 'blur', 'heat', 'light', 'distortion']
        const bx = SPLIT + 14
        let y = this.tweakBaseY

        for (const prop of PROPS) {
            const e = this.activeEffect
            if (!(prop in e) || typeof e[prop] !== 'number') continue
            if (y > 700) break

            const step   = prop === 'freq' ? 5 : 0.1
            const lbl    = this.add.text(bx, y, prop, {
                font: '10px JetBrains Mono, monospace', color: '#64748b'
            })
            const valTxt = this.add.text(bx + 110, y, e[prop].toFixed(2), {
                font: '10px JetBrains Mono, monospace', color: '#f8fafc',
                backgroundColor: '#1e293b', padding: { x: 4, y: 2 }
            })
            const minus  = this._tweakBtn(bx + 82, y, '−')
            const plus   = this._tweakBtn(bx + 156, y, '+')

            minus.on('pointerdown', () => {
                if (!this.activeEffect || !(prop in this.activeEffect)) return
                this.activeEffect[prop] = +Math.max(0, this.activeEffect[prop] - step).toFixed(3)
                valTxt.setText(this.activeEffect[prop].toFixed(2))
            })
            plus.on('pointerdown', () => {
                if (!this.activeEffect || !(prop in this.activeEffect)) return
                this.activeEffect[prop] = +(this.activeEffect[prop] + step).toFixed(3)
                valTxt.setText(this.activeEffect[prop].toFixed(2))
            })

            this.tweakRows.push({ lbl, valTxt, minus, plus })
            y += 24
        }
    }

    _tweakBtn(x, y, label) {
        return this.add.text(x, y, label, {
            font: '12px JetBrains Mono, monospace',
            color: '#94a3b8',
            backgroundColor: '#334155',
            padding: { x: 5, y: 1 }
        }).setInteractive({ useHandCursor: true })
    }

    _clearTweakRows() {
        for (const { lbl, valTxt, minus, plus } of this.tweakRows) {
            lbl.destroy(); valTxt.destroy(); minus.destroy(); plus.destroy()
        }
        this.tweakRows = []
    }
}

export default EffectsGalleryDemo
