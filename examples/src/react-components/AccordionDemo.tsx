import React, { useState } from 'react'
import {
	Accordion,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="Accordion"
				description="Collapsible content panels with keyboard navigation and ARIA support."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Bordered (default) — controlled">
				<Accordion
					items={borderedItems}
					open={openKeys}
					onOpenChange={setOpenKeys}
				/>
			</SectionCard>

			<SectionCard title="Borderless variant">
				<Accordion items={borderedItems} variant="borderless" defaultOpen={['hooks']} />
			</SectionCard>

			<SectionCard title="Multiple open panels">
				<Accordion items={multiItems} multiple defaultOpen={['one', 'two']} />
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default AccordionDemo
