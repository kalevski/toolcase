import { Container } from './Container'
import { Row } from './Row'
import { Col } from './Col'
import { Accordion } from './Accordion'
import { AccordionItem } from './AccordionItem'
import { Alert } from './Alert'
import { Badge } from './Badge'
import { Breadcrumb } from './Breadcrumb'
import { BreadcrumbItem } from './BreadcrumbItem'
import { Button } from './Button'
import { ButtonGroup } from './ButtonGroup'
import { Card } from './Card'
import { Carousel } from './Carousel'
import { CloseButton } from './CloseButton'

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
    customElements.define('tc-breadcrumb', Breadcrumb)
    customElements.define('tc-breadcrumb-item', BreadcrumbItem)
    customElements.define('tc-button', Button)
    customElements.define('tc-button-group', ButtonGroup)
    customElements.define('tc-card', Card)
    customElements.define('tc-carousel', Carousel)
    customElements.define('tc-close-button', CloseButton)
}
