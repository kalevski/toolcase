import { setHostClass } from './internal/host-class'
import { setAttr, syncOwnedNodes } from './internal/tc-element'
import { esc } from './internal/esc'
import { num } from './internal/tc-element'

// tc-results-header — the head of a list of results: a title, the count line
// under it, and whatever the surface puts beside them.
//
// From polovni.mk, where five browse pages copied the home page's `.home__heading`
// out of its stylesheet for this — which is how a shared shape ends up owned by
// whichever feature happened to draw it first.
//
// THE HEADING LEVEL IS A DECISION, NOT A DEFAULT. A results header can be the
// page's own `h1` or a section's `h2`, and an element that hardcodes one produces
// an outline skip on half its call sites (`tc-taxonomy-card`'s unconditional `h3`
// is recorded as a known defect in this library's own changelog). `heading-level`
// takes 1–6; the element writes `role="heading"` + `aria-level` on the host's own
// title node rather than emitting a different tag, because the title is patched in
// place and swapping its tag would replace the node on every level change.
//
// The trailing region is whatever you pass as children, ordered after the text
// block by CSS. Nothing is ever moved.

const TAG_NAME = 'tc-results-header'

export class ResultsHeader extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        return ['heading', 'lead', 'heading-level', 'align', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
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

    /** The count line — "128 cars" — or any one sentence about the list below. */
    get lead(): string | null {
        return this.getAttribute('lead')
    }
    set lead(v: string | null) {
        if (v != null) this.setAttribute('lead', v)
        else this.removeAttribute('lead')
    }

    /** 1–6. Where this header sits in the page's outline. */
    get headingLevel(): number {
        const level = Math.round(num(this.getAttribute('heading-level'), 2))
        return Math.min(6, Math.max(1, level))
    }
    set headingLevel(v: number) {
        this.setAttribute('heading-level', String(v))
    }

    /** `split` (default) pushes the trailing children to the far end; `stack`
     *  puts them under the text on a phone-width surface. */
    get align(): 'split' | 'stack' {
        return this.getAttribute('align') === 'stack' ? 'stack' : 'split'
    }
    set align(v: 'split' | 'stack') {
        setAttr(this, 'align', v)
    }

    private patch(): void {
        setHostClass(this, `tc-results-header tc-results-header--${this.align}`)
        const heading = this.heading
        const lead = this.lead
        syncOwnedNodes(this, [
            {
                cls: 'tc-results-header__text',
                tag: 'div',
                html:
                    heading || lead
                        ? (heading
                              ? `<span class="tc-results-header__title">${esc(heading)}</span>`
                              : '') +
                          (lead ? `<span class="tc-results-header__lead">${esc(lead)}</span>` : '')
                        : null,
            },
        ])
        const title = this.querySelector<HTMLElement>('.tc-results-header__title')
        if (title) {
            title.setAttribute('role', 'heading')
            title.setAttribute('aria-level', String(this.headingLevel))
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ResultsHeader
    }
}
