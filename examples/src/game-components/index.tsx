import { JSX } from 'react'
import StackDemo from './StackDemo'
import GridDemo from './GridDemo'
import AnchorDemo from './AnchorDemo'
import PanelDemo from './PanelDemo'

export type GameComponentCategory = 'Basic Components' | 'Layout Primitives'

export type GameComponentDef = {
	key: string
	category: GameComponentCategory
	element: JSX.Element
}

export const categories: GameComponentCategory[] = [
	'Basic Components',
	'Layout Primitives',
]

export const gameComponentExamples: GameComponentDef[] = [
	{ key: 'stack', category: 'Layout Primitives', element: <StackDemo /> },
	{ key: 'grid', category: 'Layout Primitives', element: <GridDemo /> },
	{ key: 'anchor', category: 'Layout Primitives', element: <AnchorDemo /> },
	{ key: 'panel', category: 'Basic Components', element: <PanelDemo /> },
]
