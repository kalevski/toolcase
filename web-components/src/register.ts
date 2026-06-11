import { Container } from './Container'
import { Row } from './Row'

export function register(): void {
    if (customElements.get('tc-button') !== undefined) {
        return
    }
    customElements.define('tc-container', Container)
    customElements.define('tc-row', Row)
}
