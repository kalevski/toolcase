import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/PlatformIcon.styles.js'

const MAP: Record<string, string> = { pc: '🖥', ps: '🎮', xbox: '🎮', switch: '🎮', mobile: '📱', web: '🌐', mac: '', linux: '🐧' }

@customElement('gc-platform-icon')
export class PlatformIcon extends GameElement {
    static styles = styles

    @property() platform = 'pc'
    @property({ type: Number }) size = 16
    @property({ type: Boolean }) label = false

    render() {
        return html`<style>:host { --gc-size: ${this.size}px; }</style>
            ${MAP[this.platform] || '🕹'}${this.label ? html`<span class="label">${this.platform}</span>` : nothing}`
    }
}
