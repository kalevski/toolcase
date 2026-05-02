import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/GamepadButtonPrompt.styles.js'

const MAP: Record<string, [string, string]> = {
    A: ['A', '#3aa256'], B: ['B', '#d23a3a'], X: ['X', '#3a72d2'], Y: ['Y', '#d2b73a'],
    cross: ['✕', '#88a4d8'], circle: ['◯', '#d23a3a'], square: ['□', '#c93a8e'], triangle: ['△', '#3aa28e'],
    'dpad-up': ['▲', '#7a8294'], 'dpad-down': ['▼', '#7a8294'], 'dpad-left': ['◀', '#7a8294'], 'dpad-right': ['▶', '#7a8294'],
    L1: ['L1', '#7a8294'], L2: ['L2', '#7a8294'], R1: ['R1', '#7a8294'], R2: ['R2', '#7a8294'],
    LB: ['LB', '#7a8294'], LT: ['LT', '#7a8294'], RB: ['RB', '#7a8294'], RT: ['RT', '#7a8294'],
    start: ['≡', '#7a8294'], select: ['⊟', '#7a8294'], menu: ['☰', '#7a8294'], home: ['⌂', '#7a8294'],
}

@customElement('gc-gamepad-button-prompt')
export class GamepadButtonPrompt extends GameElement {
    static styles = styles

    @property() glyph = 'A'
    @property() label = ''
    @property({ type: Number }) size = 28

    render() {
        const [icon, color] = MAP[this.glyph] ?? ['?', '#7a8294']
        return html`<style>:host { --gc-size: ${this.size}px; --gc-color: ${color}; --gc-color-bg: ${color}20; }</style>
            <span class="icon">${icon}</span>
            ${this.label ? html`<span class="label">${this.label}</span>` : nothing}`
    }
}
