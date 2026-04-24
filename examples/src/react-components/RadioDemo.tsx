import React from 'react'
import { Radio } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const RadioDemo: React.FC = () => (
	<DemoPage
		eyebrow="Inputs"
		title="Radio"
		lede="A form-check radio input with optional label and inline layout."
	>
		<DemoSection title="Basic">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<Radio label="Option A" name="basic" defaultChecked />
				<Radio label="Option B" name="basic" />
				<Radio label="Option C" name="basic" />
			</div>
		</DemoSection>

		<DemoSection title="Inline">
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
				<Radio label="Small" name="size" inline defaultChecked />
				<Radio label="Medium" name="size" inline />
				<Radio label="Large" name="size" inline />
			</div>
		</DemoSection>

		<DemoSection title="Disabled">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<Radio label="Disabled unchecked" name="dis" disabled />
				<Radio label="Disabled checked" name="dis" disabled checked />
			</div>
		</DemoSection>
	</DemoPage>
)

export default RadioDemo
