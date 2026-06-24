const TAG_NAME = 'tc-letterbox-bars'

/**
 * tc-letterbox-bars — animated cinematic letterbox bars for cutscenes and
 * reveal transitions. Ported from `gc-letterbox-bars` but voiced for the
 * web-components design system: the fantasy fills and game chrome are dropped;
 * the bars are flat ink surfaces that slide in/out via a CSS transition driven
 * by the `show` attribute.
 *
 * Purely structural: no shadow root, no slots, no events. The host fills its
 * nearest positioned ancestor (position: absolute; inset: 0) and renders two
 * `<span>` bars that transition from off-screen to visible when `[show]` is
 * set. All cosmetics flow through `--bs-letterbox-bars-*` custom properties;
 * the free-form CSS value attributes write through to those props as inline
 * overrides following the "arbitrary CSS value" porting pattern.
 */
export class LetterboxBars extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['show', 'bar-height', 'bar-color', 'duration']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.innerHTML =
                '<span class="tc-letterbox-bar tc-letterbox-bar--top"></span>' +
                '<span class="tc-letterbox-bar tc-letterbox-bar--bottom"></span>'
            this._initialised = true
        }
        this._applyTokens()
    }

    attributeChangedCallback(): void {
        // `show` is handled purely by the CSS [show] attribute selector; the
        // other three attributes update CSS custom properties via _applyTokens.
        if (this.isConnected) this._applyTokens()
    }

    get show(): boolean {
        return this.hasAttribute('show')
    }
    set show(v: boolean) {
        if (v) this.setAttribute('show', '')
        else this.removeAttribute('show')
    }

    get barHeight(): string {
        return this.getAttribute('bar-height') ?? '80px'
    }
    set barHeight(v: string) {
        if (v) this.setAttribute('bar-height', v)
        else this.removeAttribute('bar-height')
    }

    get barColor(): string {
        return this.getAttribute('bar-color') ?? 'var(--tc-ink)'
    }
    set barColor(v: string) {
        if (v) this.setAttribute('bar-color', v)
        else this.removeAttribute('bar-color')
    }

    get duration(): string {
        return this.getAttribute('duration') ?? '0.4s'
    }
    set duration(v: string) {
        if (v) this.setAttribute('duration', v)
        else this.removeAttribute('duration')
    }

    private _applyTokens(): void {
        const h = this.getAttribute('bar-height')
        if (h) this.style.setProperty('--bs-letterbox-bars-height', h)
        else this.style.removeProperty('--bs-letterbox-bars-height')

        const c = this.getAttribute('bar-color')
        if (c) this.style.setProperty('--bs-letterbox-bars-color', c)
        else this.style.removeProperty('--bs-letterbox-bars-color')

        const d = this.getAttribute('duration')
        if (d) this.style.setProperty('--bs-letterbox-bars-duration', d)
        else this.style.removeProperty('--bs-letterbox-bars-duration')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LetterboxBars
    }
}
