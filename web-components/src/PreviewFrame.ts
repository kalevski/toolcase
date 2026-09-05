import { setHostClass } from './internal/host-class'
import { setAttr, syncOwnedNodes } from './internal/tc-element'
import { esc } from './internal/esc'
import { msg } from './messages'

// tc-preview-frame — an aspect-locked embed with a loading state and a failure
// state, because both of those are what the reader actually sees most of the time.
//
// From webgame.cloud's `ProjectPreview`. The frame is the easy part; what earns an
// element is that an `<iframe>` pointed at something a consumer is BUILDING fails
// in ways a plain iframe never reports — a build that has not finished, an origin
// that refuses to be framed, a URL that 404s while a name is being typed — and an
// iframe answers all of them with a blank rectangle.
//
// THE ASPECT IS LOCKED, NOT THE HEIGHT. A preview whose height is set in px is a
// preview that letterboxes on one screen and crops on another; `aspect-ratio` on
// the frame is what makes "16 / 9" mean the same thing at 320px and at 1440px.
//
// `tc-aspect-ratio-box` is the plain aspect box in this library and this element
// does not replace it: use that one for an image you already have. This one is
// for a document being loaded, which is the part that needs states.

const TAG_NAME = 'tc-preview-frame'

export type PreviewFrameState = 'idle' | 'loading' | 'ready' | 'error'

export class PreviewFrame extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        return ['src', 'ratio', 'title-text', 'loading-label', 'error-label', 'sandbox', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._built) return
        if (name === 'src') {
            // A new src is a new load, so the state goes back to `loading` — leaving
            // a stale `error` on screen over a document that is now fine is the one
            // failure a state machine like this must not have.
            this._setState(this.src ? 'loading' : 'idle')
        }
        this.patch()
    }

    /** What to frame. Absent draws the idle state and loads nothing. */
    get src(): string | null {
        return this.getAttribute('src')
    }
    set src(v: string | null) {
        if (v != null) this.setAttribute('src', v)
        else this.removeAttribute('src')
    }

    /** `16 / 9`, `4 / 3`, `1 / 1` — anything `aspect-ratio` takes. */
    get ratio(): string {
        return this.getAttribute('ratio') ?? '16 / 9'
    }
    set ratio(v: string) {
        setAttr(this, 'ratio', v)
    }

    /** The frame's accessible name. An iframe without one is announced as
     *  "frame", which tells a screen-reader user nothing about what is in it. */
    get titleText(): string | null {
        return this.getAttribute('title-text')
    }
    set titleText(v: string | null) {
        if (v != null) this.setAttribute('title-text', v)
        else this.removeAttribute('title-text')
    }

    get loadingLabel(): string {
        return this.getAttribute('loading-label') ?? msg('loading')
    }
    set loadingLabel(v: string) {
        setAttr(this, 'loading-label', v)
    }

    get errorLabel(): string {
        return this.getAttribute('error-label') ?? msg('noData')
    }
    set errorLabel(v: string) {
        setAttr(this, 'error-label', v)
    }

    /**
     * The iframe's `sandbox`. Defaults to `allow-scripts allow-same-origin`,
     * which is what a preview of the consumer's OWN build needs and nothing more.
     *
     * Set it to `""` for a hard sandbox, or widen it deliberately. It is an
     * attribute rather than a hardcoded value because the right answer depends on
     * whose document this is, and a library that guesses either breaks the preview
     * or over-trusts it.
     */
    get sandbox(): string {
        return this.getAttribute('sandbox') ?? 'allow-scripts allow-same-origin'
    }
    set sandbox(v: string) {
        setAttr(this, 'sandbox', v)
    }

    /** Where the frame is. Read-only in practice — the element owns it. */
    get state(): PreviewFrameState {
        return (this.getAttribute('data-state') as PreviewFrameState) || 'idle'
    }

    /** Load again — the answer to a failed build that has since been fixed. */
    reload(): void {
        const frame = this.querySelector<HTMLIFrameElement>(':scope > .tc-preview-frame__frame')
        const src = this.src
        if (!frame || !src) return
        this._setState('loading')
        frame.src = src
    }

    private _setState(state: PreviewFrameState): void {
        if (this.getAttribute('data-state') === state) return
        this.setAttribute('data-state', state)
        this.dispatchEvent(
            new CustomEvent('tc-state', { bubbles: true, composed: true, detail: { state } }),
        )
    }

    private patch(): void {
        setHostClass(this, 'tc-preview-frame')
        this.style.setProperty('--bs-preview-frame-ratio', this.ratio)
        if (!this.hasAttribute('data-state')) {
            this.setAttribute('data-state', this.src ? 'loading' : 'idle')
        }

        const src = this.src
        syncOwnedNodes(this, [
            {
                cls: 'tc-preview-frame__frame',
                tag: 'iframe',
                // A void-ish element for our purposes: its content is the framed
                // document, never markup this element writes.
                html: src ? '' : null,
            },
            {
                cls: 'tc-preview-frame__status',
                tag: 'div',
                html:
                    `<span class="tc-preview-frame__status-loading">${esc(this.loadingLabel)}</span>` +
                    `<span class="tc-preview-frame__status-error">${esc(this.errorLabel)}</span>`,
            },
        ])

        const frame = this.querySelector<HTMLIFrameElement>(':scope > .tc-preview-frame__frame')
        if (!frame) return
        frame.setAttribute('sandbox', this.sandbox)
        // `lazy` and not `eager`: a preview below the fold on a list of projects is
        // a document per row, and loading them all is a build server's bad day.
        frame.setAttribute('loading', 'lazy')
        const title = this.titleText
        if (title) frame.title = title
        else frame.removeAttribute('title')
        if (src && frame.getAttribute('src') !== src) {
            frame.onload = () => this._setState('ready')
            // `onerror` on an iframe fires for a network failure but NOT for an
            // X-Frame-Options refusal, which paints an empty frame and reports
            // success. That case is the consumer's to detect (a handshake with
            // their own document) — the element does not claim to catch it.
            frame.onerror = () => this._setState('error')
            frame.src = src
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PreviewFrame
    }
}
