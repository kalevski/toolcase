import { JSX } from 'react'
import AvatarDemo from './AvatarDemo'
import ActionHeaderDemo from './ActionHeaderDemo'
import ActionItemsDemo from './ActionItemsDemo'
import ActionRowListDemo from './ActionRowListDemo'
import ContainerDemo from './ContainerDemo'
import RowDemo from './RowDemo'
import ColDemo from './ColDemo'
import AccordionDemo from './AccordionDemo'
import AlertDemo from './AlertDemo'
import BadgeDemo from './BadgeDemo'
import BrandDemo from './BrandDemo'
import BadgeRowDemo from './BadgeRowDemo'
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
import InputGroupDemo from './InputGroupDemo'
import FormDemo from './FormDemo'
import DividerDemo from './DividerDemo'
import HeadingDemo from './HeadingDemo'
import HelperTextDemo from './HelperTextDemo'
import IconDemo from './IconDemo'
import KbdDemo from './KbdDemo'
import LabelDemo from './LabelDemo'
import LinkDemo from './LinkDemo'
import SpacerDemo from './SpacerDemo'
import TextDemo from './TextDemo'
import VisuallyHiddenDemo from './VisuallyHiddenDemo'
import PulseIndicatorDemo from './PulseIndicatorDemo'
import SectionFlagDemo from './SectionFlagDemo'
import SkeletonDemo from './SkeletonDemo'
import SocialLinksDemo from './SocialLinksDemo'
import StampDemo from './StampDemo'
import StatusDotDemo from './StatusDotDemo'
import TagDemo from './TagDemo'

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
    { key: 'avatar', category: 'Components', element: <AvatarDemo /> },
    { key: 'action-header', category: 'Components', element: <ActionHeaderDemo /> },
    { key: 'action-items', category: 'Components', element: <ActionItemsDemo /> },
    { key: 'action-row-list', category: 'Components', element: <ActionRowListDemo /> },
    { key: 'container', category: 'Layout', element: <ContainerDemo /> },
    { key: 'row', category: 'Layout', element: <RowDemo /> },
    { key: 'col', category: 'Layout', element: <ColDemo /> },
    { key: 'accordion', category: 'Components', element: <AccordionDemo /> },
    { key: 'alert', category: 'Components', element: <AlertDemo /> },
    { key: 'badge', category: 'Components', element: <BadgeDemo /> },
    { key: 'brand', category: 'Content', element: <BrandDemo /> },
    { key: 'badge-row', category: 'Components', element: <BadgeRowDemo /> },
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
    { key: 'input-group', category: 'Forms', element: <InputGroupDemo /> },
    { key: 'form', category: 'Forms', element: <FormDemo /> },
    { key: 'divider', category: 'Components', element: <DividerDemo /> },
    { key: 'heading', category: 'Content', element: <HeadingDemo /> },
    { key: 'helper-text', category: 'Forms', element: <HelperTextDemo /> },
    { key: 'icon', category: 'Content', element: <IconDemo /> },
    { key: 'kbd', category: 'Content', element: <KbdDemo /> },
    { key: 'label', category: 'Forms', element: <LabelDemo /> },
    { key: 'link', category: 'Content', element: <LinkDemo /> },
    { key: 'spacer', category: 'Layout', element: <SpacerDemo /> },
    { key: 'text', category: 'Content', element: <TextDemo /> },
    { key: 'visually-hidden', category: 'Components', element: <VisuallyHiddenDemo /> },
    { key: 'pulse-indicator', category: 'Components', element: <PulseIndicatorDemo /> },
    { key: 'section-flag', category: 'Content', element: <SectionFlagDemo /> },
    { key: 'skeleton', category: 'Components', element: <SkeletonDemo /> },
    { key: 'social-links', category: 'Navigation', element: <SocialLinksDemo /> },
    { key: 'stamp', category: 'Content', element: <StampDemo /> },
    { key: 'status-dot', category: 'Content', element: <StatusDotDemo /> },
    { key: 'tag', category: 'Content', element: <TagDemo /> },
]
