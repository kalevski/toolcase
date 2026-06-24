const TAG_NAME = 'tc-artboard-backdrop'

export type ArtboardBackdropKind = 'dark' | 'scene' | 'parch'
export type ArtboardBackdropPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'

const KINDS: ArtboardBackdropKind[] = ['dark', 'scene', 'parch']
const PADDINGS: ArtboardBackdropPadding[] = ['none', 'sm', 'md', 'lg', 'xl']

/**
 * tc-artboard-backdrop — decorative full-bleed backdrop surface. Ported from
 * the game-components `gc-artboard-backdrop`, but re-skinned to the web-components
 * design system: the fantasy fills/frames are dropped in favour of the slate
 * neutral ramp, sharp corners, and 1px hairlines. Purely structural — children
 * are projected into the host as light-DOM slot content; `render()` only manages
 * the host's own classes via `classList`, never wiping its `innerHTML`.
 */
export class ArtboardBackdrop extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['kind', 'padding']
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get kind(): ArtboardBackdropKind {
        const v = this.getAttribute('kind') as ArtboardBackdropKind
        return KINDS.includes(v) ? v : 'dark'
    }
    set kind(value: ArtboardBackdropKind) {
        this.setAttribute('kind', value)
    }

    get padding(): ArtboardBackdropPadding {
        const v = this.getAttribute('padding') as ArtboardBackdropPadding
        return PADDINGS.includes(v) ? v : 'md'
    }
    set padding(value: ArtboardBackdropPadding) {
        this.setAttribute('padding', value)
    }

    private render(): void {
        // Host owns the surface; children stay in place (no innerHTML rewrite),
        // so manage component classes surgically to preserve author-added ones.
        this.classList.add('tc-artboard-backdrop')

        KINDS.forEach((k) => this.classList.remove(`tc-artboard-backdrop--${k}`))
        this.classList.add(`tc-artboard-backdrop--${this.kind}`)

        PADDINGS.forEach((p) => this.classList.remove(`tc-artboard-backdrop--pad-${p}`))
        this.classList.add(`tc-artboard-backdrop--pad-${this.padding}`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ArtboardBackdrop
    }
}
