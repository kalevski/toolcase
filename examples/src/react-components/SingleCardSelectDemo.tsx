import React, { useState } from 'react'
import { SingleCardSelect } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const options = [
	{ key: 'react', title: 'React', description: 'A JavaScript library for building user interfaces' },
	{ key: 'vue', title: 'Vue', description: 'The progressive JavaScript framework' },
	{ key: 'angular', title: 'Angular', description: 'Platform for building mobile & desktop web apps' },
	{ key: 'svelte', title: 'Svelte', description: 'Cybernetically enhanced web apps' },
]

const simpleOptions = [
	{ key: 'small', title: 'Small' },
	{ key: 'medium', title: 'Medium' },
	{ key: 'large', title: 'Large' },
]

const SingleCardSelectDemo: React.FC = () => {
	const [selected, setSelected] = useState<string | null>(null)
	const [sizeSelected, setSizeSelected] = useState<string | null>('medium')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="SingleCardSelect"
			lede="A single-selection card grid for choosing one option from a set."
		>
			<DemoSection title="With Descriptions">
				<SingleCardSelect
					options={options}
					value={selected}
					onChange={setSelected}
				/>
				<p style={{ color: '#64748b', marginTop: 12, marginBottom: 0 }}>
					Selected: <strong>{selected ?? 'none'}</strong>
				</p>
			</DemoSection>

			<DemoSection title="Simple Options (no descriptions)">
				<SingleCardSelect
					options={simpleOptions}
					value={sizeSelected}
					onChange={setSizeSelected}
					columns={3}
				/>
				<p style={{ color: '#64748b', marginTop: 12, marginBottom: 0 }}>
					Selected: <strong>{sizeSelected ?? 'none'}</strong>
				</p>
			</DemoSection>

			<DemoSection title="Custom Columns">
				<SingleCardSelect
					options={options}
					value={selected}
					onChange={setSelected}
					columns={2}
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default SingleCardSelectDemo
