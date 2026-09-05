import { lucideByName } from './internal/lucide'
import { setHostClass } from './internal/host-class'
import { setAttr, syncOwnedNodes } from './internal/tc-element'
import { esc } from './internal/esc'

// tc-lock-chip — the padlock badge that marks a paywalled row.
//
// Written identically in polovni.mk, webgame.cloud and mindmap, all three as
// `<tc-badge variant="warning" text={`🔒 ${roleName}`}>`. The emoji is why this
// is an element rather than a documented recipe: 🔒 is a glyph the platform
// picks, so the padlock is blue-grey on one machine and gold on another, it is
// announced as "locked padlock" by a screen reader in the middle of a role name,
// and it does not take the chip's colour. An inline lucide glyph does all three
// correctly and costs the same call site.
//
// It renders NOTHING when `role-name` is absent, matching all three apps: a lock
// with no tier to name is a padlock that answers no question.

const TAG_NAME = 'tc-lock-chip'

/** `warning` is the default — a lock is a "not yet", not an error. */
export type LockChipTone = 'warning' | 'neutral' | 'accent'
const TONES: LockChipTone[] = ['warning', 'neutral', 'accent']

export class LockChip extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['role-name', 'tone', 'icon', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The tier this row is behind — "Pro", "Team". Absent renders nothing. */
    get roleName(): string | null {
        return this.getAttribute('role-name')
    }
    set roleName(v: string | null) {
        if (v != null) this.setAttribute('role-name', v)
        else this.removeAttribute('role-name')
    }

    get tone(): LockChipTone {
        const v = this.getAttribute('tone') as LockChipTone
        return TONES.includes(v) ? v : 'warning'
    }
    set tone(v: LockChipTone) {
        setAttr(this, 'tone', v)
    }

    /** Lucide glyph name. `Lock` unless a surface has its own vocabulary. */
    get icon(): string {
        return this.getAttribute('icon') ?? 'Lock'
    }
    set icon(v: string) {
        setAttr(this, 'icon', v)
    }

    private patch(): void {
        const name = this.roleName
        setHostClass(this, `tc-lock-chip tc-lock-chip--${this.tone}`)
        // Hidden rather than emptied: an element that vanishes from layout when a
        // lock lifts is what the three apps wrote, and `hidden` says it once.
        this.hidden = !name
        if (!name) {
            syncOwnedNodes(this, [
                { cls: 'tc-lock-chip__icon', html: null },
                { cls: 'tc-lock-chip__label', html: null },
            ])
            return
        }
        syncOwnedNodes(this, [
            {
                cls: 'tc-lock-chip__icon',
                tag: 'span',
                html: lucideByName(this.icon) || '',
            },
            { cls: 'tc-lock-chip__label', tag: 'span', html: esc(name) },
        ])
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LockChip
    }
}
