import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	SingleCardSelect
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="SingleCardSelect"
				description="A single-selection card grid for choosing one option from a set."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="With Descriptions">
				<SingleCardSelect
					options={options}
					value={selected}
					onChange={setSelected}
				/>
				<p style={{ color: '#64748b', marginTop: 12, marginBottom: 0 }}>
					Selected: <strong>{selected ?? 'none'}</strong>
				</p>
			</SectionCard>

			<SectionCard title="Simple Options (no descriptions)">
				<SingleCardSelect
					options={simpleOptions}
					value={sizeSelected}
					onChange={setSizeSelected}
					columns={3}
				/>
				<p style={{ color: '#64748b', marginTop: 12, marginBottom: 0 }}>
					Selected: <strong>{sizeSelected ?? 'none'}</strong>
				</p>
			</SectionCard>

			<SectionCard title="Custom Columns">
				<SingleCardSelect
					options={options}
					value={selected}
					onChange={setSelected}
					columns={2}
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default SingleCardSelectDemo
