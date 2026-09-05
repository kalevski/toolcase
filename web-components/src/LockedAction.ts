import { setHostClass } from './internal/host-class'
import { setAttr, syncTrailingNodes } from './internal/tc-element'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

// tc-locked-action — an action that, without the entitlement, opens the upgrade
// path instead of doing what it says.
//
// Written identically in polovni.mk, webgame.cloud and mindmap. The shape all
// three arrived at:
//
//   <button aria-disabled={locked}>{children}{locked && <LockChip/>}</button>
//
// WHY `aria-disabled` AND NOT `disabled`. A real `disabled` button is removed
// from the tab order and answers nothing, so the reader who most needs to know
// WHY it will not work is the one who cannot reach it. `aria-disabled` keeps it
// focusable and announced as unavailable, and the click still lands — on the
// upgrade path rather than on the action.
//
// THE HOST IS THE CONTROL. It carries `role="button"`, `tabindex` and the
// Enter/Space handling itself rather than rendering an inner `<button>`, because
// an inner button would mean moving the consumer's label into it — and react-dom,
// which records `tc-locked-action` as that label's parent, throws NotFoundError
// the first time it removes one child of a two-child label individually.
//
// It emits BOTH events on a click and lets the consumer wire one: `tc-locked` when
// the entitlement is missing (open the paywall), `tc-action` when it is not.
// One handler for both is a `tc-activate` with `detail.locked`.

const TAG_NAME = 'tc-locked-action'

export interface LockedActionDetail {
    locked: boolean
    roleName: string | null
}

export class LockedAction extends HTMLElement {
    private _built = false

    /** Called instead of the action while locked. The event is the primary API. */
    onLocked: (() => void) | null = null
    /** Called when the entitlement is present. */
    onAction: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['locked', 'role-name', 'disabled', 'icon', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** Without the entitlement. The action is swallowed and `tc-locked` fires. */
    get locked(): boolean {
        return this.hasAttribute('locked')
    }
    set locked(v: boolean) {
        if (v) this.setAttribute('locked', '')
        else this.removeAttribute('locked')
    }

    /** The tier the lock names, shown in the trailing chip. */
    get roleName(): string | null {
        return this.getAttribute('role-name')
    }
    set roleName(v: string | null) {
        if (v != null) this.setAttribute('role-name', v)
        else this.removeAttribute('role-name')
    }

    /** Genuinely unavailable — no action, no upgrade path, no click at all.
     *  Distinct from `locked`, which is "available, at a price". */
    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get icon(): string {
        return this.getAttribute('icon') ?? 'Lock'
    }
    set icon(v: string) {
        setAttr(this, 'icon', v)
    }

    private patch(): void {
        const locked = this.locked
        const disabled = this.disabled
        setHostClass(this, `tc-locked-action${locked ? ' tc-locked-action--locked' : ''}`)
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        this.setAttribute('tabindex', disabled ? '-1' : '0')
        if (locked || disabled) this.setAttribute('aria-disabled', 'true')
        else this.removeAttribute('aria-disabled')

        const name = this.roleName
        // Appended after the consumer's label, which is where all three apps put
        // it and the only place it can go without moving a node.
        syncTrailingNodes(this, [
            {
                cls: 'tc-locked-action__chip',
                tag: 'span',
                html:
                    locked && name
                        ? `<span class="tc-locked-action__chip-icon">${lucideByName(this.icon)}</span>` +
                          `<span class="tc-locked-action__chip-label">${esc(name)}</span>`
                        : null,
            },
        ])
    }

    private _fire(): void {
        const locked = this.locked
        const detail: LockedActionDetail = { locked, roleName: this.roleName }
        const init = { bubbles: true, composed: true, detail }
        this.dispatchEvent(new CustomEvent('tc-activate', init))
        this.dispatchEvent(new CustomEvent(locked ? 'tc-locked' : 'tc-action', init))
        const handler = locked ? this.onLocked : this.onAction
        if (typeof handler === 'function') handler()
    }

    private _onClick = (event: MouseEvent): void => {
        if (this.disabled) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        // A control the consumer put INSIDE the action owns its own click.
        const origin = event.target as Element | null
        if (origin !== this && origin?.closest('a, button, input, select, textarea')) return
        this._fire()
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.target !== this) return
        // Space scrolls the page on a `role=button` that is not a real button.
        event.preventDefault()
        if (this.disabled) return
        this._fire()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LockedAction
    }
}
