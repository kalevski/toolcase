import { JSX } from 'react'
import ContainerDemo from './ContainerDemo'
import RowDemo from './RowDemo'
import ColDemo from './ColDemo'

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
]
