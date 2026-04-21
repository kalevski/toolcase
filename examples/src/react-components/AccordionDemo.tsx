import React, { useState } from 'react'
import { Accordion, Card, CodeSnippet } from '@toolcase/react-components'

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

	const usageCode = `import { Accordion } from '@toolcase/react-components'

const items = [
  { key: 'a', title: 'Section A', content: <p>Content A</p> },
  { key: 'b', title: 'Section B', content: <p>Content B</p> },
]

// Uncontrolled, single open
<Accordion items={items} defaultOpen={['a']} />

// Controlled, multiple open
const [open, setOpen] = useState(['a'])
<Accordion items={items} multiple open={open} onOpenChange={setOpen} />`

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Accordion</h1>
					<p className="text-muted mb-0">Collapsible content panels with keyboard navigation and ARIA support.</p>
				</div>
			</div>

			{/* Bordered (default), controlled */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Bordered (default) — controlled</h2>
						<Accordion
							items={borderedItems}
							open={openKeys}
							onOpenChange={setOpenKeys}
						/>
					</Card>
				</div>
			</div>

			{/* Borderless */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Borderless variant</h2>
						<Accordion items={borderedItems} variant="borderless" defaultOpen={['hooks']} />
					</Card>
				</div>
			</div>

			{/* Multiple open */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Multiple open panels</h2>
						<Accordion items={multiItems} multiple defaultOpen={['one', 'two']} />
					</Card>
				</div>
			</div>

			{/* Code */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}

export default AccordionDemo
