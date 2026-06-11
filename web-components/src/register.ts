import { Container } from './Container'
import { Row } from './Row'
import { Col } from './Col'
import { Accordion } from './Accordion'
import { AccordionItem } from './AccordionItem'
import { Alert } from './Alert'
import { Badge } from './Badge'

export function register(): void {
    if (customElements.get('tc-button') !== undefined) {
        return
    }
    customElements.define('tc-container', Container)
    customElements.define('tc-row', Row)
    customElements.define('tc-col', Col)
    customElements.define('tc-accordion', Accordion)
    customElements.define('tc-accordion-item', AccordionItem)
    customElements.define('tc-alert', Alert)
    customElements.define('tc-badge', Badge)
}
