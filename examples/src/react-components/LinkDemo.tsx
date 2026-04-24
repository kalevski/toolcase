import React from 'react'
import { Link } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const LinkDemo: React.FC = () => (
	<DemoPage
		eyebrow="Buttons & Actions"
		title="Link"
		lede="Styled anchor element with variant colors, underline control, and external link indicator."
	>
		<DemoSection title="Variants">
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
				<Link href="#" variant="primary">Primary</Link>
				<Link href="#" variant="secondary">Secondary</Link>
				<Link href="#" variant="info">Info</Link>
				<Link href="#" variant="success">Success</Link>
				<Link href="#" variant="warning">Warning</Link>
				<Link href="#" variant="danger">Danger</Link>
			</div>
		</DemoSection>

		<DemoSection title="Underline">
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
				<Link href="#" underline="always">Always underlined</Link>
				<Link href="#" underline="hover">Underline on hover</Link>
				<Link href="#" underline="none">No underline</Link>
			</div>
		</DemoSection>

		<DemoSection title="External">
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
				<Link href="https://example.com" external>External Link</Link>
				<Link href="https://example.com" external variant="info">External Info</Link>
			</div>
		</DemoSection>
	</DemoPage>
)

export default LinkDemo
