const TAG_NAME = 'tc-controller-layout-preview'

export type ControllerLayout = 'xbox' | 'playstation' | 'nintendo' | 'generic'

const LAYOUTS: ControllerLayout[] = ['xbox', 'playstation', 'nintendo', 'generic']

const LABELS: Record<ControllerLayout, string> = {
    xbox: 'Xbox',
    playstation: 'PlayStation',
    nintendo: 'Nintendo',
    generic: 'Generic',
}

type FacePosition = 'top' | 'right' | 'bottom' | 'left'

/**
 * tc-controller-layout-preview — a gamepad diagram with labeled face-button
 * bindings. The four face buttons relabel per `layout` (Xbox A/B/X/Y,
 * PlayStation ✕/◯/△/☐, Nintendo's swapped A/B/X/Y, or the generic directional
 * triangles). Ported from the game-components `gc-controller-layout-preview` and
 * re-skinned to the toolcase design system: a flat slate body, 1px hairline
 * strokes, mono glyph labels, no fantasy gilding. Purely presentational — no
 * events, no slots. The body and button circles are the only sanctioned curves.
 */
export class ControllerLayoutPreview extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['layout']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get layout(): ControllerLayout {
        const raw = this.getAttribute('layout') as ControllerLayout
        return LAYOUTS.includes(raw) ? raw : 'generic'
    }
    set layout(value: ControllerLayout) {
        this.setAttribute('layout', value)
    }

    // The glyph each face button carries for the active layout. These are the
    // controller's own button names (letters or shape symbols), so they read as
    // machine-facing text — rendered in JetBrains Mono, not as decorative icons.
    private glyph(layout: ControllerLayout, position: FacePosition): string {
        if (layout === 'playstation') {
            switch (position) {
                case 'top':
                    return '△' // △
                case 'right':
                    return '◯' // ◯
                case 'bottom':
                    return '✕' // ✕
                case 'left':
                    return '□' // ☐
            }
        }
        if (layout === 'nintendo') {
            switch (position) {
                case 'top':
                    return 'X'
                case 'right':
                    return 'A'
                case 'bottom':
                    return 'B'
                case 'left':
                    return 'Y'
            }
        }
        if (layout === 'xbox') {
            switch (position) {
                case 'top':
                    return 'Y'
                case 'right':
                    return 'B'
                case 'bottom':
                    return 'A'
                case 'left':
                    return 'X'
            }
        }
        switch (position) {
            case 'top':
                return '△' // △
            case 'right':
                return '▷' // ▷
            case 'bottom':
                return '▽' // ▽
            case 'left':
                return '◁' // ◁
        }
    }

    private render(): void {
        const layout = this.layout

        // Host-owned class managed surgically so author classes survive.
        this.classList.add('tc-controller-layout-preview')
        this.setAttribute('role', 'img')
        this.setAttribute('aria-label', `${LABELS[layout]} controller layout`)

        // Diamond cluster of the four face buttons, centred at (178, 60).
        const faces: Record<FacePosition, [number, number]> = {
            top: [178, 44],
            right: [194, 60],
            bottom: [178, 76],
            left: [162, 60],
        }
        const button = (pos: FacePosition): string => {
            const [cx, cy] = faces[pos]
            return `
                <circle cx="${cx}" cy="${cy}" r="11" class="tc-controller-layout-preview__button" />
                <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" class="tc-controller-layout-preview__glyph">${this.glyph(layout, pos)}</text>`
        }

        this.innerHTML = `
            <svg class="tc-controller-layout-preview__body" viewBox="0 0 240 140" aria-hidden="true">
                <path d="M40 30 Q60 18 100 22 L140 22 Q180 18 200 30 Q220 56 218 86 Q210 122 180 124 Q160 118 140 100 L100 100 Q80 118 60 124 Q30 122 22 86 Q20 56 40 30 Z" class="tc-controller-layout-preview__shell" />
                <!-- D-pad cross (left) — rectangular, stays sharp -->
                <rect x="52" y="56" width="28" height="8" class="tc-controller-layout-preview__detail" />
                <rect x="62" y="46" width="8" height="28" class="tc-controller-layout-preview__detail" />
                <!-- Thumbsticks — sanctioned circles -->
                <circle cx="96" cy="98" r="12" class="tc-controller-layout-preview__stick" />
                <circle cx="96" cy="98" r="4" class="tc-controller-layout-preview__stick-hub" />
                <circle cx="150" cy="98" r="12" class="tc-controller-layout-preview__stick" />
                <circle cx="150" cy="98" r="4" class="tc-controller-layout-preview__stick-hub" />
                <!-- Face buttons (right) — bindings relabel per layout -->
                ${button('top')}
                ${button('right')}
                ${button('bottom')}
                ${button('left')}
            </svg>
            <div class="tc-controller-layout-preview__label">${LABELS[layout]}</div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ControllerLayoutPreview
    }
}
