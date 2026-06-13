import { Brand } from './Brand'
import { Avatar } from './Avatar'
import { ActionHeader } from './ActionHeader'
import { ActionItems } from './ActionItems'
import { ActionRowList } from './ActionRowList'
import { Theme } from './Theme'
import { Container } from './Container'
import { Row } from './Row'
import { Col } from './Col'
import { Accordion } from './Accordion'
import { AccordionItem } from './AccordionItem'
import { Alert } from './Alert'
import { Badge } from './Badge'
import { BadgeRow } from './BadgeRow'
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
import { Popover } from './Popover'
import { Progress } from './Progress'
import { ProgressBar } from './ProgressBar'
import { Scrollspy } from './Scrollspy'
import { Spinner } from './Spinner'
import { Toast } from './Toast'
import { Tooltip } from './Tooltip'
import { Input } from './Input'
import { Textarea } from './Textarea'
import { Select } from './Select'
import { Option } from './Option'
import { Check } from './Check'
import { Radio } from './Radio'
import { Switch } from './Switch'
import { Range } from './Range'
import { FloatingLabel } from './FloatingLabel'
import { InputGroup } from './InputGroup'
import { InputGroupText } from './InputGroupText'
import { Divider } from './Divider'
import { Form } from './Form'
import { Heading } from './Heading'
import { HelperText } from './HelperText'
import { Icon } from './Icon'
import { Kbd } from './Kbd'
import { Label } from './Label'
import { Link } from './Link'
import { Spacer } from './Spacer'
import { Text } from './Text'
import { VisuallyHidden } from './VisuallyHidden'
import { PulseIndicator } from './PulseIndicator'
import { SectionFlag } from './SectionFlag'
import { Skeleton } from './Skeleton'

export function register(): void {
    if (customElements.get('tc-button') !== undefined) {
        return
    }
    customElements.define('tc-brand', Brand)
    customElements.define('tc-avatar', Avatar)
    customElements.define('tc-action-header', ActionHeader)
    customElements.define('tc-action-items', ActionItems)
    customElements.define('tc-action-row-list', ActionRowList)
    customElements.define('tc-theme', Theme)
    customElements.define('tc-container', Container)
    customElements.define('tc-row', Row)
    customElements.define('tc-col', Col)
    customElements.define('tc-accordion', Accordion)
    customElements.define('tc-accordion-item', AccordionItem)
    customElements.define('tc-alert', Alert)
    customElements.define('tc-badge', Badge)
    customElements.define('tc-badge-row', BadgeRow)
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
    // Cast: tc-offcanvas's boolean `scroll` accessor intentionally shadows
    // HTMLElement.scroll(), which breaks structural assignability.
    customElements.define('tc-offcanvas', Offcanvas as unknown as CustomElementConstructor)
    customElements.define('tc-nav', Nav)
    customElements.define('tc-nav-item', NavItem)
    customElements.define('tc-navbar', Navbar)
    customElements.define('tc-pagination', Pagination)
    customElements.define('tc-placeholder', Placeholder)
    customElements.define('tc-popover', Popover)
    customElements.define('tc-progress', Progress)
    customElements.define('tc-progress-bar', ProgressBar)
    customElements.define('tc-scrollspy', Scrollspy)
    customElements.define('tc-spinner', Spinner)
    customElements.define('tc-toast', Toast)
    customElements.define('tc-tooltip', Tooltip)
    customElements.define('tc-input', Input)
    customElements.define('tc-textarea', Textarea)
    customElements.define('tc-select', Select)
    customElements.define('tc-option', Option)
    customElements.define('tc-check', Check)
    customElements.define('tc-radio', Radio)
    customElements.define('tc-switch', Switch)
    customElements.define('tc-range', Range)
    customElements.define('tc-floating-label', FloatingLabel)
    customElements.define('tc-input-group', InputGroup)
    customElements.define('tc-input-group-text', InputGroupText)
    customElements.define('tc-form', Form)
    customElements.define('tc-divider', Divider)
    customElements.define('tc-heading', Heading)
    customElements.define('tc-helper-text', HelperText)
    customElements.define('tc-icon', Icon)
    customElements.define('tc-kbd', Kbd)
    customElements.define('tc-label', Label)
    customElements.define('tc-link', Link)
    customElements.define('tc-spacer', Spacer)
    customElements.define('tc-text', Text)
    customElements.define('tc-visually-hidden', VisuallyHidden)
    customElements.define('tc-pulse-indicator', PulseIndicator)
    customElements.define('tc-section-flag', SectionFlag)
    customElements.define('tc-skeleton', Skeleton)
}
