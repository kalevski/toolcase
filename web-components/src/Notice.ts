import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'

// tc-notice — the inline aside: a 3px coloured rule down the left edge, a wash of the
// same hue behind it, an optional eyebrow and an optional leading icon.
//
// The single most repeated non-trivial block in the JADI.mk phone design — five of the
// twelve screens carry one: `1e`'s cooking tip („Совет"), `1f`'s moderation notice,
// `1i`'s medical disclaimer, and two on `1k` (a stats disclaimer and a payment
// notice). A sixth shape, the `banner` variant, is `1h`'s offline strip.
//
// tc-notice IS NOT tc-alert, and the two must not be conflated.
//   tc-alert   an ANNOUNCEMENT. A padded, iconed box with a heading and a dismiss
//              button, driven by the Bootstrap-compatible variant palette, that
//              appears in response to something that just happened („Зачувано",
//              „Не успеа да се зачува") and is meant to be read and closed. It owns
//              its host class, merges a consumer's className, and fades on dismiss.
//              11 usages in the JADI.mk app today.
//   tc-notice  an ASIDE. Permanent explanatory prose that belongs to the surface it
//              sits on — the reason comments are held for moderation, the fact that a
//              calculation is an estimate, who handles payment. It has no heading, no
//              dismiss, no lifecycle and no state. If it can be closed, it is an
//              alert.
//
// WHY THE TEXT IS AN ATTRIBUTE
//   `text` and `label`, not slotted children. This element is a tinted box around a
//   two-line stack, and slot distribution means re-parenting the consumer's nodes into
//   a rendered skeleton — which throws NotFoundError under react-dom, because React
//   removes a child against the parent it BELIEVES the child has (see the header
//   comments in src/MobileShell.ts and src/AppBar.ts). tc-step-pager made the same
//   call for the same reason.
//   Consequence: this element OWNS its subtree and TAKES NO CHILDREN — anything you
//   put inside is overwritten. The design's five notices are all plain prose. Prose
//   with markup in it is an announcement or a body paragraph, not an aside; reach for
//   tc-alert or a plain block carrying the same tokens.

const TAG_NAME = 'tc-notice'

export type NoticeTone = 'info' | 'muted' | 'warning' | 'accent' | 'success' | 'danger'
const TONES: NoticeTone[] = ['info', 'muted', 'warning', 'accent', 'success', 'danger']

export type NoticeVariant = 'bar' | 'banner'
const VARIANTS: NoticeVariant[] = ['bar', 'banner']

export type NoticeSize = 'md' | 'lg'
const SIZES: NoticeSize[] = ['md', 'lg']

export class Notice extends HTMLElement {
    // Which shape the subtree was built for — icon / eyebrow presence. Text changes
    // patch that DOM in place; only a change of shape rebuilds it.
    private _builtFor = ''
    // False until this element writes `role` itself, which is how a consumer-authored
    // role survives a later `live` toggle.
    private _ownsRole = false

    static get observedAttributes(): string[] {
        // `tone`, `variant` and `size` are pure CSS state and are observed only so
        // that scripts/gen-react-types.mjs types them as JSX props — it reads this
        // list.
        return ['icon', 'label', 'live', 'size', 'text', 'tone', 'variant']
    }

    connectedCallback(): void {
        this._render()
        this._syncRole()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'tone' || name === 'variant' || name === 'size') return // pure CSS state
        if (name === 'live') {
            this._syncRole()
            return
        }
        this._render()
    }

    get tone(): NoticeTone {
        const raw = this.getAttribute('tone') as NoticeTone
        return TONES.includes(raw) ? raw : 'muted'
    }
    set tone(v: NoticeTone) {
        this.setAttribute('tone', TONES.includes(v) ? v : 'muted')
    }

    /**
     * `bar` (default) is the left-flush aside. `banner` drops the rule and the radius
     * and becomes a full-bleed strip with a bottom hairline — `1h`'s offline notice,
     * which sits in `tc-app-bar`'s `below` region.
     */
    get variant(): NoticeVariant {
        const raw = this.getAttribute('variant') as NoticeVariant
        return VARIANTS.includes(raw) ? raw : 'bar'
    }
    set variant(v: NoticeVariant) {
        this.setAttribute('variant', VARIANTS.includes(v) ? v : 'bar')
    }

    /** `md` (default) is the 11.5px aside; `lg` is `1e`'s 13px/1.5 cooking tip. */
    get size(): NoticeSize {
        const raw = this.getAttribute('size') as NoticeSize
        return SIZES.includes(raw) ? raw : 'md'
    }
    set size(v: NoticeSize) {
        this.setAttribute('size', SIZES.includes(v) ? v : 'md')
    }

    get text(): string {
        return this.getAttribute('text') ?? ''
    }
    set text(v: string | null) {
        if (v != null) this.setAttribute('text', v)
        else this.removeAttribute('text')
    }

    /** The uppercase eyebrow above the text — `1e`'s „Совет". Absent ⇒ no eyebrow. */
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    /** A lucide icon name (kebab or Pascal). Rendered at 15px in the tone colour. */
    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    /**
     * Announce the notice when it appears, instead of leaving it as static prose.
     *
     * OFF BY DEFAULT: four of the design's five notices are permanent explanatory
     * text that is already on the page when it loads, and a live region that fires on
     * mount interrupts whatever the user was reading for no reason. Turn it on for a
     * notice that APPEARS in response to a state change — `1h`'s offline strip is
     * exactly that, and a screen-reader user who cannot see the strip appear is the
     * one who most needs to be told the app went offline.
     */
    get live(): boolean {
        return this.hasAttribute('live')
    }
    set live(v: boolean) {
        this.toggleAttribute('live', v)
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private _syncRole(): void {
        // Left alone when the consumer has spoken — a notice inside a <section> may
        // already be the section's own description, and that is their call.
        if (this.hasAttribute('role') && !this._ownsRole) return
        this._ownsRole = true
        // `status` is a polite live region AND an implicit role, so the same element
        // both announces on change and reads as a status afterwards. `note` is the
        // static equivalent: "this is an aside about the surrounding content".
        this.setAttribute('role', this.live ? 'status' : 'note')
    }

    // TEXT IS PATCHED, STRUCTURE IS REBUILT — and only when the structure changed.
    // `1h`'s offline strip stays mounted while the connection flaps, and rewriting
    // innerHTML on every text change would restart any in-progress screen-reader read
    // of a role="status" region.
    private _render(): void {
        const iconName = this.icon
        const label = this.label
        const shape = `${iconName ?? ''}/${label == null ? '' : 'label'}`
        if (shape !== this._builtFor || !this.firstElementChild) {
            patchHtml(this, this._skeleton(iconName, label != null))
            this._builtFor = shape
        }
        this._patch()
    }

    // No text interpolation: the label and the text go in through `textContent` in
    // _patch, which escapes for free.
    private _skeleton(iconName: string | null, hasLabel: boolean): string {
        // lucideByName goes through icon(), which strips the fixed width/height so CSS
        // owns the size and marks the svg aria-hidden. An unknown name yields ''.
        const iconHtml = iconName ? lucideByName(iconName, 'tc-notice-icon') : ''
        return (
            iconHtml +
            `<span class="tc-notice-body">` +
            (hasLabel ? `<span class="tc-notice-label"></span>` : '') +
            `<span class="tc-notice-text"></span>` +
            `</span>`
        )
    }

    private _patch(): void {
        const write = (selector: string, text: string): void => {
            const el = this.querySelector(selector)
            // Compared before writing so an unchanged string never touches the DOM.
            if (el && el.textContent !== text) el.textContent = text
        }
        write('.tc-notice-label', this.label ?? '')
        write('.tc-notice-text', this.text)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Notice
    }
}
