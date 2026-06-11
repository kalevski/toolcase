import { JSX } from 'react'
import ContainerDemo from './ContainerDemo'
import RowDemo from './RowDemo'
import ColDemo from './ColDemo'
import AccordionDemo from './AccordionDemo'
import AlertDemo from './AlertDemo'
import BadgeDemo from './BadgeDemo'
import BreadcrumbDemo from './BreadcrumbDemo'
import ButtonDemo from './ButtonDemo'

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
    { key: 'breadcrumb', category: 'Navigation', element: <BreadcrumbDemo /> },
]
