import React, { useState } from 'react'
import { SingleCardSelect, Card, CodeSnippet } from '@toolcase/react-components'

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">SingleCardSelect</h1>
					<p className="text-muted mb-0">A single-selection card grid for choosing one option from a set.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">With Descriptions</h2>
						<SingleCardSelect
							options={options}
							value={selected}
							onChange={setSelected}
						/>
						<p className="text-muted mt-3 mb-0">
							Selected: <strong>{selected ?? 'none'}</strong>
						</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Simple Options (no descriptions)</h2>
						<SingleCardSelect
							options={simpleOptions}
							value={sizeSelected}
							onChange={setSizeSelected}
							columns={3}
						/>
						<p className="text-muted mt-3 mb-0">
							Selected: <strong>{sizeSelected ?? 'none'}</strong>
						</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Custom Columns</h2>
						<SingleCardSelect
							options={options}
							value={selected}
							onChange={setSelected}
							columns={2}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { SingleCardSelect } from '@webgame-cloud/react-components'

const options = [
  { key: 'react', title: 'React', description: 'A JS library for UIs' },
  { key: 'vue', title: 'Vue', description: 'The progressive framework' },
]

<SingleCardSelect
  options={options}
  value={selected}
  onChange={(key) => setSelected(key)}
  columns={2}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default SingleCardSelectDemo
