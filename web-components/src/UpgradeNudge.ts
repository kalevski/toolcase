import { setHostClass } from './internal/host-class'
import { bool, setAttr, syncOwnedNodes } from './internal/tc-element'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

// tc-upgrade-nudge — the inline paywall pitch: a lock chip, one sentence, and the
// call to action.
//
// polovni.mk, webgame.cloud and mindmap wrote this within two lines of each
// other. All three render nothing when the entitlement is present, which is the
// behaviour that makes it safe to leave in the tree unconditionally — the caller
// flips one attribute rather than mounting and unmounting a block.
//
// THE BLURB IS AN ATTRIBUTE, THE BODY IS YOURS. A single sentence covers the
// three apps' usage, and `blurb` keeps that a one-liner; anything longer goes in
// as children and lands in the same slot, ordered by CSS.

const TAG_NAME = 'tc-upgrade-nudge'

export class UpgradeNudge extends HTMLElement {
    private _built = false

    /** Invoked by the CTA. The `tc-upgrade` event is the primary API. */
    onUpgrade: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['locked', 'role-name', 'blurb', 'cta-label', 'icon', 'variant', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.addEventListener('click', this._onClick)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** Present renders the nudge; absent renders nothing. Default is LOCKED, so a
     *  nudge left in the tree with no attributes still says something. */
    get locked(): boolean {
        return this.getAttribute('locked') !== 'false'
    }
    set locked(v: boolean) {
        // `bool()` and not a truthiness test: this is a TRI-STATE attribute (the
        // default is on), so `"false"` is a string a consumer can legitimately send
        // and `locked={0}` from React must mean the same thing.
        this.setAttribute('locked', bool(v) ? 'true' : 'false')
    }

    get roleName(): string | null {
        return this.getAttribute('role-name')
    }
    set roleName(v: string | null) {
        if (v != null) this.setAttribute('role-name', v)
        else this.removeAttribute('role-name')
    }

    /** The one sentence explaining what is behind the lock. */
    get blurb(): string | null {
        return this.getAttribute('blurb')
    }
    set blurb(v: string | null) {
        if (v != null) this.setAttribute('blurb', v)
        else this.removeAttribute('blurb')
    }

    get ctaLabel(): string | null {
        return this.getAttribute('cta-label')
    }
    set ctaLabel(v: string | null) {
        if (v != null) this.setAttribute('cta-label', v)
        else this.removeAttribute('cta-label')
    }

    get icon(): string {
        return this.getAttribute('icon') ?? 'Lock'
    }
    set icon(v: string) {
        setAttr(this, 'icon', v)
    }

    /** `inline` is the row inside a panel; `panel` is the boxed pitch. */
    get variant(): 'inline' | 'panel' {
        return this.getAttribute('variant') === 'panel' ? 'panel' : 'inline'
    }
    set variant(v: 'inline' | 'panel') {
        setAttr(this, 'variant', v)
    }

    private patch(): void {
        const locked = this.locked
        setHostClass(this, `tc-upgrade-nudge tc-upgrade-nudge--${this.variant}`)
        this.hidden = !locked
        if (!locked) {
            syncOwnedNodes(this, [
                { cls: 'tc-upgrade-nudge__chip', html: null },
                { cls: 'tc-upgrade-nudge__text', html: null },
                { cls: 'tc-upgrade-nudge__cta', html: null },
            ])
            return
        }

        const name = this.roleName
        const blurb = this.blurb
        const cta = this.ctaLabel
        syncOwnedNodes(this, [
            {
                cls: 'tc-upgrade-nudge__chip',
                tag: 'span',
                html: name
                    ? `<span class="tc-upgrade-nudge__chip-icon">${lucideByName(this.icon)}</span>` +
                      `<span class="tc-upgrade-nudge__chip-label">${esc(name)}</span>`
                    : null,
            },
            {
                cls: 'tc-upgrade-nudge__text',
                tag: 'span',
                html: blurb ? esc(blurb) : null,
            },
            {
                cls: 'tc-upgrade-nudge__cta',
                tag: 'button',
                html: cta ? esc(cta) : null,
            },
        ])
        const button = this.querySelector<HTMLButtonElement>(':scope > .tc-upgrade-nudge__cta')
        if (button) button.type = 'button'
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        if (!origin?.closest('.tc-upgrade-nudge__cta')) return
        this.dispatchEvent(new CustomEvent('tc-upgrade', { bubbles: true, composed: true }))
        if (typeof this.onUpgrade === 'function') this.onUpgrade()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: UpgradeNudge
    }
}
