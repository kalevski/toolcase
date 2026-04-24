import React, { useState } from 'react'
import {
	JSONSchemaDef,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Editors</RichPageHeaderChip>}
				title="JSONSchemaDef"
				description="Define JSON schemas with typed properties, object/array references, and editable labels."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Controlled">
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
					<JSONSchemaDef
						label={label}
						value={value}
						refList={REF_LIST}
						onChange={setValue}
						onLabelChange={setLabel}
					/>
					<div>
						<h6 style={{ color: '#64748b', marginBottom: 8 }}>Output</h6>
						<pre style={{ padding: 12, background: '#f8fafc', fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
							{JSON.stringify({ label, properties: JSON.parse(value) }, null, 2)}
						</pre>
					</div>
				</div>
			</SectionCard>

			<SectionCard title="Uncontrolled (defaultValue)">
				<JSONSchemaDef
					label=""
					refList={REF_LIST}
					defaultValue="[]"
					onChange={(v) => console.log('uncontrolled:', v)}
				/>
			</SectionCard>

			<SectionCard title="Disabled">
				<JSONSchemaDef
					label="Locked"
					value={INITIAL_VALUE}
					refList={REF_LIST}
					disabled
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default JSONSchemaDefDemo
