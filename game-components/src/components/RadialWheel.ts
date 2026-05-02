import { html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/RadialWheel.styles.js'

export interface RadialOption { id: string; icon?: string; label?: string; color?: string; disabled?: boolean }

@customElement('gc-radial-wheel')
export class RadialWheel extends GameElement {
    static styles = styles

    @property({ type: Array }) options: RadialOption[] = []
    @property({ type: Boolean, reflect: true }) open = false
    @property({ type: Number }) radius = 110
    @property({ type: Number, attribute: 'option-size' }) optionSize = 56
    @property({ attribute: 'center-label' }) centerLabel = ''

    @state() private _hover: string | null = null

    private _onKey = (event: KeyboardEvent) => {
        if (this.open && event.key === 'Escape') this.emit('close')
    }
    connectedCallback(): void { super.connectedCallback(); window.addEventListener('keydown', this._onKey) }
    disconnectedCallback(): void { window.removeEventListener('keydown', this._onKey); super.disconnectedCallback() }

    render() {
        if (!this.open) return nothing
        const diameter = (this.radius + this.optionSize) * 2
        const hoverLabel = this._hover ? this.options.find((option) => option.id === this._hover)?.label : this.centerLabel
        return html`<style>:host { --gc-diameter: ${diameter}px; --gc-option-size: ${this.optionSize}px; }</style>
            <div class="wheel" @click=${(event: Event) => event.stopPropagation()}>
                <div class="center">${hoverLabel ?? ''}</div>
                ${this.options.map((option, i) => {
                    const angle = (i / this.options.length) * Math.PI * 2 - Math.PI / 2
                    const x = Math.cos(angle) * this.radius
                    const y = Math.sin(angle) * this.radius
                    return html`<button
                        ?disabled=${option.disabled}
                        style="left: calc(50% + ${x}px - ${this.optionSize / 2}px); top: calc(50% + ${y}px - ${this.optionSize / 2}px); --gc-color: ${option.color ?? 'var(--gc-accent)'};"
                        @mouseenter=${() => { this._hover = option.id }}
                        @mouseleave=${() => { this._hover = null }}
                        @click=${() => { if (!option.disabled) { this.emit('select', { id: option.id }); this.emit('close') } }}>
                        ${option.icon ?? ''}
                    </button>`
                })}
            </div>`
    }

    private _onBackdrop = () => this.emit('close')

    protected createRenderRoot(): ShadowRoot {
        const root = super.createRenderRoot() as ShadowRoot
        this.addEventListener('click', this._onBackdrop)
        return root
    }
}
