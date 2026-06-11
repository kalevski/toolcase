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
import { Collapse } from './Collapse'
import { Dropdown } from './Dropdown'
import { DropdownItem } from './DropdownItem'
import { ListGroup } from './ListGroup'
import { ListGroupItem } from './ListGroupItem'
import { Modal } from './Modal'
import { Offcanvas } from './Offcanvas'
import { Nav } from './Nav'
import { NavItem } from './NavItem'
import { Navbar } from './Navbar'
import { Pagination } from './Pagination'
import { Placeholder } from './Placeholder'

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
    customElements.define('tc-collapse', Collapse)
    customElements.define('tc-dropdown', Dropdown)
    customElements.define('tc-dropdown-item', DropdownItem)
    customElements.define('tc-list-group', ListGroup)
    customElements.define('tc-list-group-item', ListGroupItem)
    customElements.define('tc-modal', Modal)
    customElements.define('tc-offcanvas', Offcanvas)
    customElements.define('tc-nav', Nav)
    customElements.define('tc-nav-item', NavItem)
    customElements.define('tc-navbar', Navbar)
    customElements.define('tc-pagination', Pagination)
    customElements.define('tc-placeholder', Placeholder)
}
