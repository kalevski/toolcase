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
import OffcanvasDemo from './OffcanvasDemo'
import NavDemo from './NavDemo'
import NavbarDemo from './NavbarDemo'
import PaginationDemo from './PaginationDemo'
import PlaceholderDemo from './PlaceholderDemo'
import PopoverDemo from './PopoverDemo'
import ProgressDemo from './ProgressDemo'
import ScrollspyDemo from './ScrollspyDemo'
import SpinnerDemo from './SpinnerDemo'
import ToastDemo from './ToastDemo'
import TooltipDemo from './TooltipDemo'
import InputDemo from './InputDemo'
import TextareaDemo from './TextareaDemo'
import SelectDemo from './SelectDemo'
import CheckDemo from './CheckDemo'
import RadioDemo from './RadioDemo'
import SwitchDemo from './SwitchDemo'
import RangeDemo from './RangeDemo'
import FloatingLabelDemo from './FloatingLabelDemo'

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
    { key: 'navbar', category: 'Navigation', element: <NavbarDemo /> },
    { key: 'pagination', category: 'Navigation', element: <PaginationDemo /> },
    { key: 'modal', category: 'Overlays & Feedback', element: <ModalDemo /> },
    { key: 'offcanvas', category: 'Overlays & Feedback', element: <OffcanvasDemo /> },
    { key: 'popover', category: 'Overlays & Feedback', element: <PopoverDemo /> },
    { key: 'tooltip', category: 'Overlays & Feedback', element: <TooltipDemo /> },
    { key: 'toast', category: 'Overlays & Feedback', element: <ToastDemo /> },
    { key: 'placeholder', category: 'Components', element: <PlaceholderDemo /> },
    { key: 'progress', category: 'Components', element: <ProgressDemo /> },
    { key: 'spinner', category: 'Components', element: <SpinnerDemo /> },
    { key: 'scrollspy', category: 'Navigation', element: <ScrollspyDemo /> },
    { key: 'input', category: 'Forms', element: <InputDemo /> },
    { key: 'textarea', category: 'Forms', element: <TextareaDemo /> },
    { key: 'select', category: 'Forms', element: <SelectDemo /> },
    { key: 'check', category: 'Forms', element: <CheckDemo /> },
    { key: 'radio', category: 'Forms', element: <RadioDemo /> },
    { key: 'switch', category: 'Forms', element: <SwitchDemo /> },
    { key: 'range', category: 'Forms', element: <RangeDemo /> },
    { key: 'floating-label', category: 'Forms', element: <FloatingLabelDemo /> },
]
