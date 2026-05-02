import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/PageIndicator.styles.js'

@customElement('gc-page-indicator')
export class PageIndicator extends GameElement {
    static styles = styles

    @property({ type: Number }) count = 0
    @property({ type: Number }) index = 0
    @property({ type: Number }) size = 8
    @property({ type: Number }) gap = 8
    @property() color = 'rgba(255,255,255,0.25)'
    @property({ attribute: 'active-color' }) activeColor = ''

    render() {
        const cssVars = `--gc-size: ${this.size}px; --gc-gap: ${this.gap}px; --gc-color: ${this.color};${this.activeColor ? ` --gc-active: ${this.activeColor};` : ''}`
        return html`<style>:host { ${cssVars} }</style>
            ${Array.from({ length: this.count }).map((_, i) => html`
                <button
                    aria-label="Go to page ${i + 1}"
                    class=${i === this.index ? 'active' : ''}
                    @click=${() => this.emit('select', { index: i })}
                ></button>
            `)}`
    }
}
