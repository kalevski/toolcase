import React, { useState } from 'react'
import { Accordion } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const borderedItems = [
	{
		key: 'intro',
		title: 'What is React?',
		content: 'React is a JavaScript library for building user interfaces. It lets you compose complex UIs from small, isolated pieces of code called "components".',
	},
	{
		key: 'hooks',
		title: 'What are React Hooks?',
		content: 'Hooks are functions that let you "hook into" React state and lifecycle features from function components. They were added in React 16.8.',
	},
	{
		key: 'disabled',
		title: 'This item is disabled',
		content: 'You should not be able to see this.',
		disabled: true,
	},
	{
		key: 'tsx',
		title: 'TypeScript with React',
		content: 'TypeScript provides static type checking, which helps catch bugs early and improves the developer experience when working with React components.',
	},
]

const multiItems = [
	{
		key: 'one',
		title: 'Section One',
		content: 'Content for section one. Multiple sections can be open at the same time when multiple=true.',
	},
	{
		key: 'two',
		title: 'Section Two',
		content: 'Content for section two. Try opening both sections!',
	},
	{
		key: 'three',
		title: 'Section Three',
		content: 'Content for section three.',
	},
]

export const AccordionDemo: React.FC = () => {
	const [openKeys, setOpenKeys] = useState<string[]>(['intro'])

	return (
		<DemoPage
			eyebrow="Layout & Surfaces"
			title="Accordion"
			lede="Collapsible content panels with keyboard navigation and ARIA support."
		>
			<DemoSection title="Bordered (default) — controlled">
				<Accordion
					items={borderedItems}
					open={openKeys}
					onOpenChange={setOpenKeys}
				/>
			</DemoSection>

			<DemoSection title="Borderless variant">
				<Accordion items={borderedItems} variant="borderless" defaultOpen={['hooks']} />
			</DemoSection>

			<DemoSection title="Multiple open panels">
				<Accordion items={multiItems} multiple defaultOpen={['one', 'two']} />
			</DemoSection>
		</DemoPage>
	)
}

export default AccordionDemo
