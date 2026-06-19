const TAG_NAME = 'tc-blur-overlay'

/**
 * tc-blur-overlay — full-surface backdrop-blur scrim (pause / dialog overlay).
 * Ported from the game-components `gc-blur-overlay`, but re-skinned to the
 * web-components design system: the fantasy chrome is dropped in favour of a
 * flat slate-ink scrim sitting on the fixed overlay (`--tc-z-*`) tier, with the
 * slotted content centred over the blurred surface.
 *
 * Public API mirrors the source — two free-form CSS-value attributes
 * (`blur-amount`, `background`) with matching JS properties, and a default slot
 * for the content shown above the scrim. Purely structural: children stay in
 * place (no `innerHTML` rewrite); `render()` only manages the host's own class
 * via `classList` and writes the two cosmetic values as `--bs-blur-overlay-*`
 * custom properties when their attributes are present, letting the SCSS partial
 * own the defaults (the "arbitrary CSS value" porting pattern).
 */
export class BlurOverlay extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['blur-amount', 'background']
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get blurAmount(): string {
        return this.getAttribute('blur-amount') ?? '8px'
    }
    set blurAmount(value: string) {
        if (value) this.setAttribute('blur-amount', value)
        else this.removeAttribute('blur-amount')
    }

    get background(): string {
        return this.getAttribute('background') ?? 'rgba(15, 23, 42, 0.45)'
    }
    set background(value: string) {
        if (value) this.setAttribute('background', value)
        else this.removeAttribute('background')
    }

    private render(): void {
        // Host is the scrim surface; children are projected as light-DOM slot
        // content, so manage the component class surgically to preserve any
        // author-added classes and never wipe innerHTML.
        this.classList.add('tc-blur-overlay')

        // Free-form CSS values cannot be expressed as class modifiers — write
        // them as inline custom properties when provided; otherwise fall back to
        // the SCSS-declared defaults.
        const blur = this.getAttribute('blur-amount')
        if (blur) this.style.setProperty('--bs-blur-overlay-blur', blur)
        else this.style.removeProperty('--bs-blur-overlay-blur')

        const background = this.getAttribute('background')
        if (background) this.style.setProperty('--bs-blur-overlay-bg', background)
        else this.style.removeProperty('--bs-blur-overlay-bg')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BlurOverlay
    }
}
