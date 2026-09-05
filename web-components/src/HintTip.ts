import { Tooltip as BsTooltip } from './internal/Tooltip'
import { setHostClass } from './internal/host-class'
import { setAttr, syncOwnedNodes } from './internal/tc-element'
import { lucideByName } from './internal/lucide'
import { msg } from './messages'

// tc-hint-tip — a sentence a heading can carry without spending a line on it.
//
// From polovni.mk, where every spec block opened with a lead paragraph explaining
// the figures under it: read once it is the reason the block makes sense, read on
// every visit it is a paragraph between the reader and the bars. The tip keeps
// the sentence one tap from the heading it belongs to and gives the block back
// its first line.
//
// TWO TIP ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-tooltip   wraps SOMETHING ELSE and explains it. The trigger is whatever
//                you put inside; the default trigger list is `hover focus`.
//   tc-hint-tip  IS the trigger — a 13px info glyph with nothing inside it — and
//                its trigger is `click`. That is the whole difference and it is
//                not cosmetic: there is no hover on a phone, so a hover tip beside
//                a heading is a sentence a touch reader can never read. A real
//                button fires `click` on Enter and Space too, so one trigger
//                covers tap, mouse and keyboard — where `focus` alongside `click`
//                would show the tip and immediately toggle it away.
//
// The consuming app had to set `content` / `placement` / `trigger` through a ref
// in an effect, because `title` — the one spelling its JSX types accepted — draws
// the browser's own native tooltip on top of this one. Here they are attributes.

const TAG_NAME = 'tc-hint-tip'

export type HintTipPlacement = 'auto' | 'top' | 'right' | 'bottom' | 'left'
const PLACEMENTS: HintTipPlacement[] = ['auto', 'top', 'right', 'bottom', 'left']

export class HintTip extends HTMLElement {
    private _built = false
    private _tip: BsTooltip | null = null

    static get observedAttributes(): string[] {
        return ['text', 'placement', 'icon', 'label', 'size', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
        this._attach()
    }

    disconnectedCallback(): void {
        this._detach()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
        // Content and placement are constructor options of the tip, so a change
        // means a new instance. Cheap: the tip only exists while it is open.
        this._detach()
        this._attach()
    }

    /** The sentence. Rendered as TEXT — no markup. */
    get text(): string {
        return this.getAttribute('text') ?? ''
    }
    set text(v: string) {
        setAttr(this, 'text', v)
    }

    /** Bottom by default: these sit under a heading at the top of a card, and a
     *  tip above one would leave the card. */
    get placement(): HintTipPlacement {
        const v = this.getAttribute('placement') as HintTipPlacement
        return PLACEMENTS.includes(v) ? v : 'bottom'
    }
    set placement(v: HintTipPlacement) {
        setAttr(this, 'placement', v)
    }

    get icon(): string {
        return this.getAttribute('icon') ?? 'Info'
    }
    set icon(v: string) {
        setAttr(this, 'icon', v)
    }

    /** The button's accessible name. Defaults to the registry's `tip`. */
    get label(): string {
        return this.getAttribute('label') ?? msg('tip')
    }
    set label(v: string) {
        setAttr(this, 'label', v)
    }

    /** Show the tip. Imperative counterpart of a tap. */
    show(): void {
        this._tip?.show()
    }

    /** Hide the tip. */
    hide(): void {
        this._tip?.hide()
    }

    private patch(): void {
        setHostClass(this, 'tc-hint-tip')
        syncOwnedNodes(this, [
            {
                cls: 'tc-hint-tip__button',
                tag: 'button',
                html: lucideByName(this.icon),
            },
        ])
        const button = this.querySelector<HTMLButtonElement>(':scope > .tc-hint-tip__button')
        if (!button) return
        button.type = 'button'
        button.setAttribute('aria-label', this.label)
    }

    private _attach(): void {
        const text = this.text
        if (!text) return
        const button = this.querySelector<HTMLButtonElement>(':scope > .tc-hint-tip__button')
        if (!button) return
        this._tip = new BsTooltip(button, {
            title: text,
            placement: this.placement,
            trigger: 'click',
        })
    }

    private _detach(): void {
        this._tip?.dispose()
        this._tip = null
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: HintTip
    }
}
