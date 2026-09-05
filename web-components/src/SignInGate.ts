import { setHostClass } from './internal/host-class'
import { syncOwnedNodes } from './internal/tc-element'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

// tc-sign-in-gate — the member wall, as a page body.
//
// From polovni.mk: a heading, one sentence saying what is behind the wall and why
// it costs nothing, and a button to the login. Three pages needed the same shape
// once the first one had it.
//
// IT RENDERS INSTEAD OF THE DATA, NEVER OVER IT. A blurred-out answer is still an
// answer to anyone who reads the DOM, and it makes the gate look like a trick.
// That is a usage rule rather than something the element can enforce, but it is
// the reason this is a BODY (a block in the content flow) and not an overlay —
// there is no `open`, no scrim and no z-index here, deliberately.
//
// The action is an event, not an href: where login lives is a routing decision,
// and an element that hardcoded `/login` would be wrong in every app that mounts
// its auth under a different path. Pass `href` when a plain link is right.

const TAG_NAME = 'tc-sign-in-gate'

export class SignInGate extends HTMLElement {
    private _built = false

    /** Invoked on activation. The `tc-sign-in` event is the primary API. */
    onSignIn: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['heading', 'lead', 'action-label', 'icon', 'href', 'footnote', 'class']
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

    get heading(): string | null {
        return this.getAttribute('heading')
    }
    set heading(v: string | null) {
        if (v != null) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    /** One sentence on what is behind the wall. */
    get lead(): string | null {
        return this.getAttribute('lead')
    }
    set lead(v: string | null) {
        if (v != null) this.setAttribute('lead', v)
        else this.removeAttribute('lead')
    }

    get actionLabel(): string | null {
        return this.getAttribute('action-label')
    }
    set actionLabel(v: string | null) {
        if (v != null) this.setAttribute('action-label', v)
        else this.removeAttribute('action-label')
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    /** Renders the action as a real link. Without it the action is a button that
     *  fires `tc-sign-in` and the app decides where that goes. */
    get href(): string | null {
        return this.getAttribute('href')
    }
    set href(v: string | null) {
        if (v != null) this.setAttribute('href', v)
        else this.removeAttribute('href')
    }

    /** The line under the button — usually "it's free". */
    get footnote(): string | null {
        return this.getAttribute('footnote')
    }
    set footnote(v: string | null) {
        if (v != null) this.setAttribute('footnote', v)
        else this.removeAttribute('footnote')
    }

    private patch(): void {
        setHostClass(this, 'tc-sign-in-gate')
        const icon = this.icon
        const heading = this.heading
        const lead = this.lead
        const label = this.actionLabel
        const href = this.href
        const footnote = this.footnote

        const action = label
            ? href
                ? `<a class="tc-sign-in-gate__button" href="${esc(href)}">${esc(label)}</a>`
                : `<button type="button" class="tc-sign-in-gate__button">${esc(label)}</button>`
            : null

        syncOwnedNodes(this, [
            {
                cls: 'tc-sign-in-gate__mark',
                tag: 'span',
                html: icon ? lucideByName(icon) : null,
            },
            {
                cls: 'tc-sign-in-gate__heading',
                tag: 'h2',
                html: heading ? esc(heading) : null,
            },
            {
                cls: 'tc-sign-in-gate__lead',
                tag: 'p',
                html: lead ? esc(lead) : null,
            },
            {
                cls: 'tc-sign-in-gate__actions',
                tag: 'div',
                html: action,
            },
            {
                cls: 'tc-sign-in-gate__footnote',
                tag: 'p',
                html: footnote ? esc(footnote) : null,
            },
        ])
        const mark = this.querySelector<HTMLElement>(':scope > .tc-sign-in-gate__mark')
        if (mark) mark.setAttribute('aria-hidden', 'true')
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        if (!origin?.closest('.tc-sign-in-gate__button')) return
        const detail = { href: this.href }
        const fired = this.dispatchEvent(
            new CustomEvent('tc-sign-in', {
                bubbles: true,
                composed: true,
                // Cancelable so a client-side router can take over the anchor's own
                // navigation the same way tc-page-tabs lets it.
                cancelable: true,
                detail,
            }),
        )
        if (!fired) event.preventDefault()
        if (typeof this.onSignIn === 'function') this.onSignIn()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SignInGate
    }
}
