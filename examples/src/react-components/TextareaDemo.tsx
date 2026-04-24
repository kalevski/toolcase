import React from 'react'
import { Textarea } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const TextareaDemo: React.FC = () => (
	<DemoPage
		eyebrow="Inputs"
		title="Textarea"
		lede="A labeled textarea with form-control styling."
	>
		<DemoSection title="Basic">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Textarea label="Description" placeholder="Enter a description..." rows={3} />
				<Textarea label="Notes" placeholder="Additional notes..." rows={4} />
			</div>
		</DemoSection>

		<DemoSection title="States">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Textarea label="Editable" placeholder="Type here..." rows={3} />
				<Textarea label="Disabled" placeholder="Cannot edit" rows={3} disabled />
				<Textarea label="Read-only" value="This content cannot be changed." rows={2} readOnly />
			</div>
		</DemoSection>

		<DemoSection title="Without Label">
			<Textarea placeholder="Write your message..." rows={4} />
		</DemoSection>
	</DemoPage>
)

export default TextareaDemo
