import React, { useState } from 'react'
import { JSONSchemaDef, Card, CodeSnippet } from '../../src'

const INITIAL_VALUE = JSON.stringify([
	{ key: 'property1', type: 'string', defaultValue: 'def' },
	{ key: 'property2', type: 'number', defaultValue: 123 },
	{ key: 'property3', type: 'boolean', defaultValue: true },
	{ key: 'property4', type: 'array', objRef: 'abcd1234' },
	{ key: 'property5', type: 'object', objRef: 'abcd1234' },
])

const REF_LIST = [
	{ id: 'abcd1234', label: 'customType' },
	{ id: 'abcd1235', label: 'customType 2' },
]

const JSONSchemaDefDemo = () => {
	const [value, setValue] = useState(INITIAL_VALUE)
	const [label, setLabel] = useState('MySchema')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">JSONSchemaDef</h1>
					<p className="text-muted mb-4">Define JSON schemas with typed properties, object/array references, and editable labels.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Controlled</h2>
						<div className="row g-3">
							<div className="col-md-6">
								<JSONSchemaDef
									label={label}
									value={value}
									refList={REF_LIST}
									onChange={setValue}
									onLabelChange={setLabel}
								/>
							</div>
							<div className="col-md-6">
								<h6 className="text-muted mb-2">Output</h6>
								<pre className="p-3 bg-light rounded" style={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
									{JSON.stringify({ label, properties: JSON.parse(value) }, null, 2)}
								</pre>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5 g-4">
				<div className="col-md-6">
					<Card>
						<h2 className="h5 mb-3">Uncontrolled (defaultValue)</h2>
						<JSONSchemaDef
							label=""
							refList={REF_LIST}
							defaultValue="[]"
							onChange={(v) => console.log('uncontrolled:', v)}
						/>
					</Card>
				</div>
				<div className="col-md-6">
					<Card>
						<h2 className="h5 mb-3">Disabled</h2>
						<JSONSchemaDef
							label="Locked"
							value={INITIAL_VALUE}
							refList={REF_LIST}
							disabled
						/>
					</Card>
				</div>
			</div>

			{/* Usage */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { JSONSchemaDef } from '@webgame-cloud/react-components'

<JSONSchemaDef
  label="MySchema"
  value={schemaJson}
  refList={[{ id: 'abc', label: 'CustomType' }]}
  onChange={setSchemaJson}
  onLabelChange={setLabel}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default JSONSchemaDefDemo
