import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/Stack.styles.js'

@customElement('gc-stack')
export class Stack extends GameElement {
    static styles = styles

    @property() direction: 'vertical' | 'horizontal' = 'vertical'
    @property() gap = '8px'
    @property() align = ''
    @property() justify = ''
    @property({ type: Boolean }) wrap = false
    @property({ type: Boolean }) inline = false

    render() {
        const vars = [
            ['--gc-direction', this.direction === 'horizontal' ? 'row' : 'column'],
            ['--gc-gap', this.gap],
            ['--gc-display', this.inline ? 'inline-flex' : 'flex'],
            ['--gc-wrap', this.wrap ? 'wrap' : 'nowrap'],
        ]
        if (this.align) vars.push(['--gc-align', this.align])
        if (this.justify) vars.push(['--gc-justify', this.justify])
        const styleString = vars.map(([k, v]) => `${k}: ${v}`).join('; ')
        return html`<style>:host { ${styleString} }</style><slot></slot>`
    }
}
