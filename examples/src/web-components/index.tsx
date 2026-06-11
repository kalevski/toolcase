import { JSX } from 'react'
import ContainerDemo from './ContainerDemo'
import RowDemo from './RowDemo'
import ColDemo from './ColDemo'
import AccordionDemo from './AccordionDemo'
import AlertDemo from './AlertDemo'
import BadgeDemo from './BadgeDemo'
import BreadcrumbDemo from './BreadcrumbDemo'
import ButtonDemo from './ButtonDemo'
import ButtonGroupDemo from './ButtonGroupDemo'
import CardDemo from './CardDemo'
import CarouselDemo from './CarouselDemo'
import CloseButtonDemo from './CloseButtonDemo'
import CollapseDemo from './CollapseDemo'
import DropdownDemo from './DropdownDemo'
import ListGroupDemo from './ListGroupDemo'
import ModalDemo from './ModalDemo'
import NavDemo from './NavDemo'

export type WebComponentCategory = 'Layout' | 'Content' | 'Components' | 'Overlays & Feedback' | 'Navigation' | 'Forms'

export type WebComponentDef = {
    key: string
    category: WebComponentCategory
    element: JSX.Element
}

export const categories: WebComponentCategory[] = [
    'Layout',
    'Content',
    'Components',
    'Overlays & Feedback',
    'Navigation',
    'Forms',
]

export const webComponentExamples: WebComponentDef[] = [
    { key: 'container', category: 'Layout', element: <ContainerDemo /> },
    { key: 'row', category: 'Layout', element: <RowDemo /> },
    { key: 'col', category: 'Layout', element: <ColDemo /> },
    { key: 'accordion', category: 'Components', element: <AccordionDemo /> },
    { key: 'alert', category: 'Components', element: <AlertDemo /> },
    { key: 'badge', category: 'Components', element: <BadgeDemo /> },
    { key: 'button', category: 'Components', element: <ButtonDemo /> },
    { key: 'button-group', category: 'Components', element: <ButtonGroupDemo /> },
    { key: 'card', category: 'Components', element: <CardDemo /> },
    { key: 'carousel', category: 'Components', element: <CarouselDemo /> },
    { key: 'close-button', category: 'Components', element: <CloseButtonDemo /> },
    { key: 'collapse', category: 'Components', element: <CollapseDemo /> },
    { key: 'dropdown', category: 'Components', element: <DropdownDemo /> },
    { key: 'list-group', category: 'Components', element: <ListGroupDemo /> },
    { key: 'breadcrumb', category: 'Navigation', element: <BreadcrumbDemo /> },
    { key: 'nav', category: 'Navigation', element: <NavDemo /> },
    { key: 'modal', category: 'Overlays & Feedback', element: <ModalDemo /> },
]
